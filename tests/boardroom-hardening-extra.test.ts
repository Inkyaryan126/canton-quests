import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evaluateChangedPaths } from '../lib/boardroom/commitGate';
import { salvageWorkingTree } from '../lib/boardroom/salvage';
import { runSupervisor, type GitOps } from '../lib/boardroom/supervisor';
import { createTask, getTask } from '../lib/boardroom/tasks';

let repoDir: string;
let wrapperDir: string;

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' });
}

function gitOps(): GitOps {
  return { run: git };
}

function script(name: string, body: string): string {
  const p = path.join(wrapperDir, name);
  fs.writeFileSync(p, `#!/bin/sh\nset -eu\n${body}\n`, { mode: 0o755 });
  return p;
}

beforeEach(() => {
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-extra-hardening-'));
  wrapperDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-extra-wrappers-'));

  execFileSync('git', ['init', '-q'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.email', 'boardroom-test@example.com'], { cwd: repoDir });
  execFileSync('git', ['config', 'user.name', 'Boardroom Test'], { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, 'README.md'), 'init\n');
  fs.writeFileSync(path.join(repoDir, '.gitignore'), '.boardroom/\nboardroom/\n');
  git(['add', 'README.md', '.gitignore']);
  git(['commit', '-q', '-m', 'init']);
});

afterEach(() => {
  fs.rmSync(repoDir, { recursive: true, force: true });
  fs.rmSync(wrapperDir, { recursive: true, force: true });
});

describe('extra write-scope hardening', () => {
  it('does not authorize a sibling path merely because it shares a string prefix', () => {
    expect(evaluateChangedPaths(['lib/board'], ['lib/boardroom/x.ts']).decision).toBe('BLOCK');
    expect(evaluateChangedPaths(['components/QuestCard.tsx'], ['components/QuestCard.tsx.bak']).decision).toBe('BLOCK');
    expect(evaluateChangedPaths(['lib/boardroom'], ['lib/boardroom/tasks.ts']).decision).toBe('COMMIT');
  });
});

describe('salvage identity verification', () => {
  it('refuses to reuse a pre-existing stash when the requested path has nothing new to salvage', () => {
    fs.writeFileSync(path.join(repoDir, 'old-wip.txt'), 'old\n');
    git(['stash', 'push', '-u', '-m', 'old-wip']);
    const previous = git(['rev-parse', 'stash@{0}']).trim();

    expect(() =>
      salvageWorkingTree(gitOps(), {
        taskId: 'TASK-CLEAN',
        agent: 'AGY',
        attempt: 1,
        runId: 'RUN-CLEAN',
        paths: ['README.md'],
        reason: 'should not reuse old stash',
      })
    ).toThrow();

    expect(git(['rev-parse', 'stash@{0}']).trim()).toBe(previous);
  });
});

describe('phase barrier', () => {
  it('does not advance into a later phase when an earlier run-queue phase is blocked', async () => {
    const phase1 = createTask({
      title: 'Recon must finish first',
      goal: 'Stay in scope',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['allowed.txt'],
      testsRequired: [],
      root: repoDir,
    });
    const phase2 = createTask({
      title: 'Core system must wait',
      goal: 'Do not run while Phase 1 is blocked',
      priority: 'HIGH',
      phase: 'PHASE_2_CORE_EXPERIENCE_SYSTEM',
      primaryAgent: 'CLAUDE',
      writeScope: ['phase2.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const agy = script('agy-oob.sh', `printf 'oops\n' > out-of-scope.txt`);
    const claude = script('claude-should-not-run.sh', `printf 'should-not-run\n' > phase2.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agy, CLAUDE: claude },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 10,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('PHASE_BARRIER_BLOCKED');
    expect(getTask(phase1.taskId, repoDir)?.status).toBe('BLOCKED');
    expect(getTask(phase2.taskId, repoDir)?.status).toBe('QUEUED');
    expect(fs.existsSync(path.join(repoDir, 'phase2.txt'))).toBe(false);
    expect(git(['status', '--short']).trim()).toBe('');
  });
});

describe('git-history guard', () => {
  it('stops immediately if an agent commits or otherwise moves HEAD', async () => {
    createTask({
      title: 'Agent must not commit',
      goal: 'Boardroom owns commits',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['agent-owned.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const agy = script(
      'agy-commits.sh',
      `printf 'agent commit\n' > agent-owned.txt\ngit add agent-owned.txt\ngit commit -q -m 'agent illegally committed'`
    );

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agy },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 5,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('AGENT_MUTATED_GIT_HISTORY');
    expect(result.actionsRequired.join(' ')).toMatch(/changed git history/i);
  });
});

describe('Astra exhaustion failover and reset conservation', () => {
  it('fails over the task after probe-confirmed Astra exhaustion without immediately asking for reset #1', async () => {
    const task = createTask({
      title: 'Fallback can finish',
      goal: 'Do not spend Astra reset if Claude can finish',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'ASTRA',
      fallbackAgent1: 'CLAUDE',
      fallbackAgent2: 'AGY',
      writeScope: ['fix.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const astra = script('astra-exhausted.sh', `printf 'Error: usage limit reached for this account\n' >&2\nexit 1`);
    const claude = script('claude-fallback.sh', `printf 'fixed\n' > fix.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { ASTRA: astra, CLAUDE: claude },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 10,
      perTaskTimeoutMs: 5_000,
    });

    expect(getTask(task.taskId, repoDir)?.status).toBe('DONE');
    expect(getTask(task.taskId, repoDir)?.attempts.some((a) => a.agent === 'CLAUDE' && a.outcome === 'SUCCEEDED')).toBe(true);
    expect(result.actionsRequired.join(' ')).not.toContain('ASTRA RESET CREDIT #1');
  });

  it('requests the reset at the protected final-integration barrier if Astra is still unavailable', async () => {
    createTask({
      title: 'Warmup task',
      goal: 'Force Astra exhaustion, then let Claude finish',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'ASTRA',
      fallbackAgent1: 'CLAUDE',
      fallbackAgent2: 'AGY',
      writeScope: ['warmup.txt'],
      testsRequired: [],
      root: repoDir,
    });
    const finalTask = createTask({
      title: 'Protected final Astra pass',
      goal: 'Must wait for Astra',
      priority: 'LOW',
      phase: 'PHASE_6_ASTRA_FINAL_PASS',
      primaryAgent: 'ASTRA',
      fallbackAgent1: 'CLAUDE',
      fallbackAgent2: 'AGY',
      writeScope: ['final.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const astra = script('astra-exhausted-final.sh', `printf 'Error: usage limit reached for this account\n' >&2\nexit 1`);
    const claude = script('claude-warmup.sh', `printf 'warm\n' > warmup.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { ASTRA: astra, CLAUDE: claude },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 10,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('ASTRA_RESET_REQUIRED_FOR_FINAL_INTEGRATION');
    expect(result.actionsRequired.join(' ')).toContain('ASTRA RESET CREDIT #1');
    expect(getTask(finalTask.taskId, repoDir)?.status).toBe('QUEUED');
  });
});
