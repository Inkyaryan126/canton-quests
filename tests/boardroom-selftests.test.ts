// Canton Quests Boardroom V2 — supervisor-loop self-tests (Scenarios A-J).
//
// Every test runs the REAL runSupervisor() loop against a disposable,
// throwaway local git repo and tests/fixtures/fake-cli.sh (optionally
// wrapped with fixed env vars per agent) — never the real Canton Quests
// repo, never real Astra/Claude/Agy usage. This is the layer that actually
// matters: it proves the wiring between lock/tasks/attempts/budget/
// routing/commitGate/preflight/runLifecycle/adapters, not just each part
// in isolation.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runSupervisor, type GitOps } from '../lib/boardroom/supervisor';
import { createTask, getTask, updateTaskStatus } from '../lib/boardroom/tasks';
import { getLock, acquireLock } from '../lib/boardroom/lock';
import { getBudgetState, selfReportAllowance, confirmResetRedeemed } from '../lib/boardroom/budget';
import { checkThreshold } from '../lib/boardroom/attempts';
import type { AgentName, TestResult } from '../lib/boardroom/types';

const FAKE_CLI = path.resolve(__dirname, 'fixtures', 'fake-cli.sh');

let repoDir: string;
let wrapperDir: string;

beforeEach(() => {
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-repo-'));
  execFileSync('git', ['init', '-q'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.email', 'boardroom-test@example.com'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.name', 'Boardroom Test'], { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'init\n');
  // Ignore Boardroom's own bookkeeping in these throwaway test repos so its
  // writes (the run marker, handoff docs, the morning report) never make
  // bootstrap's clean-working-tree check fail between chained runs in a
  // test — mirroring how .boardroom/runtime/ is already gitignored in the
  // real Canton Quests repo (boardroom/handoffs and boardroom/reports would
  // normally be tracked there; ignoring them here is a test-only simplification).
  fs.writeFileSync(path.join(repoDir, '.gitignore'), '.boardroom/\nboardroom/\n');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: repoDir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: repoDir });

  wrapperDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-wrappers-'));
});

afterEach(() => {
  fs.rmSync(repoDir, { recursive: true, force: true });
  fs.rmSync(wrapperDir, { recursive: true, force: true });
});

function gitAt(dir: string, callLog?: string[][]): GitOps {
  return {
    run(args: string[]): string {
      callLog?.push(args);
      return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
    },
  };
}

/** Writes a tiny wrapper around fake-cli.sh with fixed env vars baked in, so different agents/tasks in the same run can behave differently despite process.env being global. */
function makeWrapper(env: Record<string, string>, name: string): string {
  const exports = Object.entries(env)
    .map(([k, v]) => `export ${k}=${JSON.stringify(v)}`)
    .join('\n');
  const content = `#!/bin/sh\n${exports}\nexec ${JSON.stringify(FAKE_CLI)} "$@"\n`;
  const scriptPath = path.join(wrapperDir, `${name}.sh`);
  fs.writeFileSync(scriptPath, content, { mode: 0o755 });
  return scriptPath;
}

function successWrapper(name: string, touchFile: string): string {
  return makeWrapper({ FAKE_CLI_EXIT_CODE: '0', FAKE_CLI_STDOUT: 'done', FAKE_CLI_TOUCH_FILE: touchFile, FAKE_CLI_TOUCH_CONTENT: 'changed' }, name);
}

function exhaustedWrapper(name: string, phrase = 'usage limit reached'): string {
  return makeWrapper({ FAKE_CLI_EXIT_CODE: '1', FAKE_CLI_STDERR: phrase }, name);
}

/** Fails with an exhaustion-looking signal on the FIRST invocation only, then succeeds cleanly — models the real Claude 429 that had already cleared by the time of a follow-up probe. */
function transientExhaustionWrapper(name: string, touchFileOnRecovery: string): string {
  const counterFile = path.join(wrapperDir, `${name}-counter`);
  return makeWrapper(
    {
      FAKE_CLI_COUNTER_FILE: counterFile,
      FAKE_CLI_FAIL_FIRST_N: '1',
      FAKE_CLI_EXIT_CODE: '1',
      FAKE_CLI_STDOUT: '{"is_error":true,"api_error_status":429,"result":"You\'ve hit your session limit"}',
      FAKE_CLI_TOUCH_FILE: touchFileOnRecovery,
      FAKE_CLI_TOUCH_CONTENT: 'recovered',
    },
    name
  );
}

const passingTests: TestResult[] = [{ command: 'fake-test', passed: true, summary: 'ok', at: new Date().toISOString() }];
const noopRunTests = () => passingTests;

describe('happy path', () => {
  it('runs one task end-to-end: bootstrap, agent edits a file, tests pass, Boardroom commits, report is written', async () => {
    createTask({
      title: 'Add a README note',
      goal: 'Append a note',
      priority: 'MEDIUM',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['note.txt'],
      testsRequired: ['fake-test'],
      root: repoDir,
    });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { AGY: successWrapper('agy-ok', 'note.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(true);
    expect(result.stopReason).toBe('NO_MORE_READY_TASKS');
    expect(result.iterations).toBe(1);
    expect(fs.existsSync(path.join(repoDir, 'note.txt'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'boardroom', 'reports', 'MORNING_REPORT.md'))).toBe(true);

    const log = execFileSync('git', ['log', '--oneline'], { cwd: repoDir, encoding: 'utf8' });
    expect(log.split('\n').filter(Boolean)).toHaveLength(2); // init + Boardroom's commit

    const tasks = execFileSync('git', ['show', '--stat', 'HEAD'], { cwd: repoDir, encoding: 'utf8' });
    expect(tasks).toContain('note.txt');
    expect(getLock(repoDir)).toBeNull(); // released after the commit
  });

  it('BLOCKs a task whose agent touched an out-of-scope file, without staging or committing anything', async () => {
    const task = createTask({
      title: 'Scoped task',
      goal: 'Touch only note.txt',
      priority: 'MEDIUM',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['note.txt'],
      testsRequired: ['fake-test'],
      root: repoDir,
    });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { AGY: successWrapper('agy-oob', 'not-in-scope.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(true);
    const updated = getTask(task.taskId, repoDir)!;
    expect(updated.status).toBe('BLOCKED');
    expect(updated.blockers.join(' ')).toMatch(/outside WRITE_SCOPE/);
    expect(updated.currentCommit).toBeUndefined();

    const log = execFileSync('git', ['log', '--oneline'], { cwd: repoDir, encoding: 'utf8' });
    expect(log.split('\n').filter(Boolean)).toHaveLength(1); // only the init commit — nothing was committed

    // The agent's edit is neither committed NOR left sitting in the tree —
    // it's salvaged into a Boardroom-owned stash+tag, and the tree is clean.
    expect(updated.salvage).toHaveLength(1);
    expect(updated.salvage[0].pathsSalvaged).toEqual(['not-in-scope.txt']);
    const gitStatus = execFileSync('git', ['status', '--short'], { cwd: repoDir, encoding: 'utf8' });
    expect(gitStatus.trim()).toBe('');
    expect(fs.existsSync(path.join(repoDir, 'not-in-scope.txt'))).toBe(false);
    const stashContent = execFileSync('git', ['stash', 'show', '-p', '-u', updated.salvage[0].tagRef], { cwd: repoDir, encoding: 'utf8' });
    expect(stashContent).toContain('not-in-scope.txt');
  });

  it('CONTAMINATION FIX: a blocked task never leaves its edits for the next task to inherit', async () => {
    // Reproduces the exact first-overnight-run bug: task1 (AGY) gets blocked
    // with an out-of-scope leftover file sitting in the tree; task2 (CLAUDE,
    // a completely different, correctly-scoped task) must NOT see task1's
    // leftover file when ITS OWN write-scope check runs — before the fix,
    // task2 would inherit task1's leftover and get falsely blocked too.
    const task1 = createTask({ title: 'Task 1', goal: 'G', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['scope-a.txt'], testsRequired: [], root: repoDir });
    const task2 = createTask({ title: 'Task 2', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'CLAUDE', writeScope: ['scope-b.txt'], testsRequired: [], root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: {
        AGY: successWrapper('agy-contaminator', 'leftover-from-task1.txt'), // out of task1's own scope
        CLAUDE: successWrapper('claude-clean', 'scope-b.txt'), // correctly in task2's scope
      },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(true);

    const updated1 = getTask(task1.taskId, repoDir)!;
    expect(updated1.status).toBe('BLOCKED');
    expect(updated1.blockers.join(' ')).toMatch(/leftover-from-task1\.txt/);
    expect(updated1.salvage).toHaveLength(1);

    // The critical assertion: task2 succeeds cleanly. If task1's leftover
    // file had contaminated the shared tree, task2's own git-status check
    // would have picked it up too (it's not in task2's declared scope
    // either) and task2 would have been wrongly BLOCKED — exactly what
    // happened on the real first overnight run.
    const updated2 = getTask(task2.taskId, repoDir)!;
    expect(updated2.status).toBe('DONE');
    expect(updated2.blockers).toEqual([]);
    expect(updated2.filesTouched).toEqual(['scope-b.txt']);

    const gitStatus = execFileSync('git', ['status', '--short'], { cwd: repoDir, encoding: 'utf8' });
    expect(gitStatus.trim()).toBe('');
    expect(fs.existsSync(path.join(repoDir, 'leftover-from-task1.txt'))).toBe(false);
    expect(fs.existsSync(path.join(repoDir, 'scope-b.txt'))).toBe(true); // task2's real, committed work
  });

  it('holds the write lock through validation and the commit, releasing only after the checkpoint lands', async () => {
    createTask({ title: 'T', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['note.txt'], testsRequired: ['fake-test'], root: repoDir });

    let sawLockDuringValidation = false;
    const runTestsSpy = (commands: string[], cwd: string): TestResult[] => {
      const lock = getLock(repoDir);
      sawLockDuringValidation = lock?.holder === 'AGY';
      return passingTests;
    };

    await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: runTestsSpy,
      binaryOverrides: { AGY: successWrapper('agy-lockcheck', 'note.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(sawLockDuringValidation).toBe(true);
    expect(getLock(repoDir)).toBeNull();
  });

  it('never issues a git push or deploy command itself', async () => {
    createTask({ title: 'T', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['note.txt'], testsRequired: ['fake-test'], root: repoDir });
    const calls: string[][] = [];

    await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir, calls),
      runTests: noopRunTests,
      binaryOverrides: { AGY: successWrapper('agy-nopush', 'note.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(calls.some((c) => c[0] === 'push')).toBe(false);
    expect(calls.some((c) => c[0] === 'deploy')).toBe(false);
  });
});

describe('Scenario A — Astra hits a usage limit mid-task', () => {
  it('marks Astra unavailable but DEFERS reset redemption (no fallback exists for this task, yet Boardroom still does not spend a reset credit until final integration or total exhaustion)', async () => {
    createTask({ title: 'Hard bug', goal: 'Fix it', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'ASTRA', writeScope: ['fix.txt'], testsRequired: [], root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { ASTRA: exhaustedWrapper('astra-exhausted') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.actionsRequired.some((a) => a.includes('DEFERRED'))).toBe(true);
    expect(result.actionsRequired.some((a) => a.includes('RESET CREDIT'))).toBe(false);
    expect(getBudgetState(repoDir).resetCreditsUsed).toBe(0);
  });

  it('FALSE-POSITIVE FIX: a transient exhaustion signal that clears on a follow-up probe does NOT exile the agent or request a reset', async () => {
    // Reproduces the real incident: Claude's actual task hit a genuine 429
    // ("You've hit your session limit"), and a manual claude -p "Reply with
    // exactly: OK" run immediately afterward succeeded — proving Claude was
    // not actually unavailable. The fixed supervisor now performs exactly
    // that kind of follow-up probe itself before exiling an agent.
    createTask({ title: 'Hard bug', goal: 'Fix it', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'ASTRA', writeScope: ['fix.txt'], testsRequired: [], root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { ASTRA: transientExhaustionWrapper('astra-transient', 'fix.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.actionsRequired.some((a) => a.includes('treating it as transient'))).toBe(true);
    expect(result.actionsRequired.some((a) => a.includes('RESET CREDIT'))).toBe(false);
    expect(getBudgetState(repoDir).resetCreditsUsed).toBe(0);
  });
});

describe('Scenario B — Claude unavailable, work fails over to Agy', () => {
  it('after two Claude crashes this run, a Claude-primary task routes to its fallback instead', async () => {
    const deadBinary = path.join(wrapperDir, 'does-not-exist.sh');

    createTask({ title: 'Crash 1', goal: 'G', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'CLAUDE', writeScope: ['a.txt'], testsRequired: [], root: repoDir });
    createTask({ title: 'Crash 2', goal: 'G', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'CLAUDE', writeScope: ['b.txt'], testsRequired: [], root: repoDir });
    const task3 = createTask({ title: 'Failover target', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'CLAUDE', fallbackAgent1: 'AGY', fallbackAgent2: 'ASTRA', writeScope: ['c.txt'], testsRequired: [], root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { CLAUDE: deadBinary, AGY: successWrapper('agy-failover', 'c.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(true);
    const updated = getTask(task3.taskId, repoDir)!;
    expect(updated.status).toBe('DONE');
    expect(updated.attempts.some((a) => a.agent === 'AGY' && a.outcome === 'SUCCEEDED')).toBe(true);
  });
});

describe('Scenario C — Agy dies mid-implementation', () => {
  it('a crashed Agy invocation is recorded as a failed attempt and the task is BLOCKED, never falsely committed', async () => {
    const deadBinary = path.join(wrapperDir, 'does-not-exist-either.sh');
    const task = createTask({ title: 'Routine edit', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', fallbackAgent1: 'AGY', fallbackAgent2: 'AGY', writeScope: ['x.txt'], testsRequired: [], root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { AGY: deadBinary },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(true);
    const updated = getTask(task.taskId, repoDir)!;
    expect(updated.status).toBe('BLOCKED');
    expect(updated.currentCommit).toBeUndefined();
    const log = execFileSync('git', ['log', '--oneline'], { cwd: repoDir, encoding: 'utf8' });
    expect(log.split('\n').filter(Boolean)).toHaveLength(1);
  });
});

describe('Scenario D — Astra allowance drops to CRITICAL mid-run', () => {
  it('a category-tagged Astra-worthy task is dynamically re-routed to Claude once the self-reported tier is CRITICAL', async () => {
    selfReportAllowance(15, 'DUSTIN', repoDir); // CRITICAL tier
    const task = createTask({
      title: 'Cross-component work',
      goal: 'G',
      priority: 'HIGH',
      phase: 'PHASE_2_CORE_EXPERIENCE_SYSTEM',
      primaryAgent: 'ASTRA', // static field intentionally mismatched — category should win
      category: 'MAJOR_CROSS_COMPONENT',
      writeScope: ['y.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { CLAUDE: successWrapper('claude-conserve', 'y.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(true);
    const updated = getTask(task.taskId, repoDir)!;
    expect(updated.status).toBe('DONE');
    expect(updated.attempts.every((a) => a.agent !== 'ASTRA')).toBe(true);
    expect(updated.attempts.some((a) => a.agent === 'CLAUDE' && a.outcome === 'SUCCEEDED')).toBe(true);
  });
});

describe('Scenario E — Reset #1 already used, Astra exhausts again', () => {
  it('defers reset #2 the same way it deferred #1 — a single-task probe-confirmed exhaustion never auto-spends a credit', async () => {
    confirmResetRedeemed(1, repoDir);
    createTask({ title: 'Another hard bug', goal: 'G', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'ASTRA', writeScope: ['z.txt'], testsRequired: [], root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { ASTRA: exhaustedWrapper('astra-exhausted-again', 'weekly limit reached') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.actionsRequired.some((a) => a.includes('DEFERRED'))).toBe(true);
    expect(result.actionsRequired.some((a) => a.includes('RESET CREDIT'))).toBe(false);
    expect(getBudgetState(repoDir).resetCreditsUsed).toBe(1); // unchanged — #1 already redeemed earlier; #2 deferred, not requested
  });
});

describe('Scenario F — only Astra remains', () => {
  it('Claude and Agy both go unavailable from usage exhaustion; a later Astra-primary task still completes', async () => {
    createTask({ title: 'Claude task', goal: 'G', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'CLAUDE', writeScope: ['c1.txt'], testsRequired: [], root: repoDir });
    createTask({ title: 'Agy task', goal: 'G', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['c2.txt'], testsRequired: [], root: repoDir });
    const task3 = createTask({ title: 'Astra-only task', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'ASTRA', writeScope: ['c3.txt'], testsRequired: [], root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: {
        CLAUDE: exhaustedWrapper('claude-exhausted', 'quota exceeded'),
        AGY: exhaustedWrapper('agy-exhausted', 'rate limit'),
        ASTRA: successWrapper('astra-only', 'c3.txt'),
      },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(true);
    const updated = getTask(task3.taskId, repoDir)!;
    expect(updated.status).toBe('DONE');
    expect(updated.attempts.some((a) => a.agent === 'ASTRA' && a.outcome === 'SUCCEEDED')).toBe(true);
  });
});

describe('Scenario G — same approach fails twice, no silent third retry', () => {
  it('forces a strategy change: checkThreshold fires after two failed runs, and a still-BLOCKED task is never auto-picked a third time', async () => {
    const task = createTask({ title: 'Stubborn bug', goal: 'G', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['stubborn.txt'], testsRequired: ['fake-test'], root: repoDir });

    const failingTests: TestResult[] = [{ command: 'fake-test', passed: false, summary: 'still broken', at: new Date().toISOString() }];
    const alwaysFail = () => failingTests;

    await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: alwaysFail,
      binaryOverrides: { AGY: successWrapper('agy-attempt-1', 'stubborn.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });
    const afterFirstFailure = getTask(task.taskId, repoDir)!;
    expect(afterFirstFailure.status).toBe('BLOCKED');
    // The failed attempt's edit is salvaged (never silently discarded) and the
    // tree is automatically restored to clean — no manual cleanup needed
    // before a second overnight pass, unlike before the contamination fix.
    expect(afterFirstFailure.salvage).toHaveLength(1);
    expect(execFileSync('git', ['status', '--short'], { cwd: repoDir, encoding: 'utf8' }).trim()).toBe('');
    updateTaskStatus(task.taskId, 'READY', repoDir); // simulate a second overnight pass picking the same open task back up

    await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: alwaysFail,
      binaryOverrides: { AGY: successWrapper('agy-attempt-2', 'stubborn.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    const afterTwoFailures = getTask(task.taskId, repoDir)!;
    expect(afterTwoFailures.status).toBe('BLOCKED');
    expect(afterTwoFailures.attempts.filter((a) => a.outcome === 'FAILED')).toHaveLength(2);
    // Both failed attempts are independently salvaged — nothing was ever
    // silently discarded across the two runs, and each has its own stable tag.
    expect(afterTwoFailures.salvage).toHaveLength(2);
    expect(new Set(afterTwoFailures.salvage.map((s) => s.tagRef)).size).toBe(2);
    expect(execFileSync('git', ['status', '--short'], { cwd: repoDir, encoding: 'utf8' }).trim()).toBe('');
    const forced = checkThreshold(task.taskId, repoDir);
    expect(forced).not.toBeNull();
    expect(forced?.options).toContain('CHANGE_APPROACH');

    // A third run must NOT silently retry the same BLOCKED task.
    const thirdRun = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: alwaysFail,
      binaryOverrides: { AGY: successWrapper('agy-attempt-3', 'stubborn.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });
    expect(thirdRun.stopReason).toBe('NO_MORE_READY_TASKS');
    expect(getTask(task.taskId, repoDir)!.attempts).toHaveLength(2); // no third attempt was made
  });
});

describe('Scenario H — two agents request the write lock simultaneously', () => {
  it('refuses to start when a live process already holds the lock, rather than racing it', async () => {
    createTask({ title: 'T', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['note.txt'], testsRequired: [], root: repoDir });
    acquireLock({ holder: 'ASTRA', taskId: 'TASK-external', startingCommit: 'deadbeef', pid: process.pid, root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { AGY: successWrapper('agy-contended', 'note.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(false);
    expect(result.stopReason).toMatch(/WRITE_LOCK_HELD_BY_LIVE_PROCESS/);
    expect(getLock(repoDir)?.holder).toBe('ASTRA'); // untouched — no unsafe recovery was attempted
  });
});

describe('Scenario I — a CLI crashed while holding the lock', () => {
  it('recovers a lock left by a dead PID automatically and proceeds normally', async () => {
    createTask({ title: 'T', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['note.txt'], testsRequired: [], root: repoDir });
    acquireLock({ holder: 'ASTRA', taskId: 'TASK-crashed', startingCommit: 'deadbeef', pid: 999_999, root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { AGY: successWrapper('agy-recovered', 'note.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(true);
    expect(result.stopReason).toBe('NO_MORE_READY_TASKS');
    expect(getLock(repoDir)).toBeNull();
  });
});

describe('Scenario J — an agent attempts a production deployment', () => {
  it('the production guard blocks push/db-migrate/deploy outright, independent of anything the supervisor does', async () => {
    const { evaluateGuardedAction } = await import('../lib/boardroom/productionGuard');
    expect(evaluateGuardedAction({ kind: 'git-push', target: 'main', remote: 'origin' }).allowed).toBe(false);
    expect(evaluateGuardedAction({ kind: 'db-migrate' }).allowed).toBe(false);
    expect(evaluateGuardedAction({ kind: 'deploy', target: 'production' }).allowed).toBe(false);
  });

  it('the supervisor itself structurally never calls push/deploy/db-migrate for any task outcome (success, block, or crash)', async () => {
    createTask({ title: 'Succeeds', goal: 'G', priority: 'HIGH', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['ok.txt'], testsRequired: [], root: repoDir });
    createTask({ title: 'Blocked', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['scoped.txt'], testsRequired: [], root: repoDir });
    const calls: string[][] = [];

    await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir, calls),
      runTests: noopRunTests,
      binaryOverrides: { AGY: successWrapper('agy-mixed', 'ok.txt') }, // second task's agent touches ok.txt too -> out-of-scope BLOCK
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    const commandsUsed = new Set(calls.map((c) => c[0]));
    expect(commandsUsed.has('push')).toBe(false);
    expect(commandsUsed.has('deploy')).toBe(false);
  });
});

describe('bootstrap refusal path', () => {
  it('refuses to run at all on a dirty working tree, and touches no Boardroom state', async () => {
    fs.writeFileSync(path.join(repoDir, 'uncommitted.txt'), 'dirty');
    createTask({ title: 'T', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'AGY', writeScope: ['note.txt'], testsRequired: [], root: repoDir });

    const result = await runSupervisor({
      root: repoDir,
      git: gitAt(repoDir),
      runTests: noopRunTests,
      binaryOverrides: { AGY: successWrapper('agy-dirty', 'note.txt') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'NOT ACTIVE (test)' }),
    });

    expect(result.ok).toBe(false);
    expect(result.stopReason).toMatch(/BOOTSTRAP_FAILED \(clean-working-tree\)/);
    expect(fs.existsSync(path.join(repoDir, '.boardroom', 'runtime', 'AUTONOMOUS_RUN_ACTIVE'))).toBe(false);
  });
});
