// Canton Quests Boardroom V2 — launch-critical verification gate tests.
//
// This gate is opt-in and additive: a task never sets `launchCritical` today
// unless it says so explicitly, so the whole suite must prove (a) default
// behavior is byte-for-byte unchanged, and (b) once opted in, TESTS_REQUIRED
// passing alone is no longer sufficient to reach DONE.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evaluateVerification } from '../lib/boardroom/verificationGate';
import { runSupervisor, type GitOps } from '../lib/boardroom/supervisor';
import { createTask, getTask } from '../lib/boardroom/tasks';
import type { Task } from '../lib/boardroom/types';

function baseTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    taskId: 'TASK-test',
    title: 't',
    goal: 'g',
    priority: 'MEDIUM',
    phase: 'PHASE_1_RECON',
    primaryAgent: 'CLAUDE',
    status: 'ACTIVE',
    writeScope: [],
    acceptanceCriteria: [],
    salvage: [],
    decisions: [],
    filesTouched: [],
    testsRequired: [],
    testResults: [],
    knownFailures: [],
    attempts: [],
    confidence: 'ASSUMPTION',
    blockers: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('evaluateVerification (pure gate function)', () => {
  it('PASSes a non-launch-critical task unconditionally — no behavior change from before this feature existed', () => {
    expect(evaluateVerification(baseTask()).decision).toBe('PASS');
    expect(evaluateVerification(baseTask({ launchCritical: false })).decision).toBe('PASS');
    // Even with no verificationEvidence at all.
    expect(evaluateVerification(baseTask({ launchCritical: undefined, verificationEvidence: undefined })).decision).toBe('PASS');
  });

  it('BLOCKs a launch-critical task with no verificationEvidence at all', () => {
    const result = evaluateVerification(baseTask({ launchCritical: true }));
    expect(result.decision).toBe('BLOCK');
    expect(result.reason).toMatch(/no verificationEvidence recorded/i);
  });

  it('BLOCKs a launch-critical task whose exercisedFlow is empty', () => {
    const result = evaluateVerification(
      baseTask({ launchCritical: true, verificationEvidence: { exercisedFlow: '', unverifiedItems: [] } })
    );
    expect(result.decision).toBe('BLOCK');
    expect(result.reason).toMatch(/exercisedFlow/i);
  });

  it('BLOCKs a launch-critical task whose exercisedFlow is a placeholder', () => {
    for (const placeholder of ['n/a', 'N/A', 'TODO', 'tbd', '...', '   ']) {
      const result = evaluateVerification(
        baseTask({ launchCritical: true, verificationEvidence: { exercisedFlow: placeholder, unverifiedItems: [] } })
      );
      expect(result.decision).toBe('BLOCK');
    }
  });

  it('BLOCKs a launch-critical task whose unverifiedItems key is missing entirely', () => {
    const result = evaluateVerification(
      baseTask({
        launchCritical: true,
        // @ts-expect-error — intentionally omitting the required key to prove the gate catches it even if a caller bypasses the type.
        verificationEvidence: { exercisedFlow: 'started dev server and completed quest X end to end' },
      })
    );
    expect(result.decision).toBe('BLOCK');
    expect(result.reason).toMatch(/unverifiedItems/i);
  });

  it('PASSes a launch-critical task with a real exercisedFlow and an explicit empty unverifiedItems array', () => {
    const result = evaluateVerification(
      baseTask({
        launchCritical: true,
        verificationEvidence: {
          exercisedFlow: 'Started dev server, registered a test player, completed quest X in browser, confirmed leaderboard updated.',
          unverifiedItems: [],
        },
      })
    );
    expect(result.decision).toBe('PASS');
  });

  it('PASSes a launch-critical task with a non-empty unverifiedItems list too', () => {
    const result = evaluateVerification(
      baseTask({
        launchCritical: true,
        verificationEvidence: {
          exercisedFlow: 'Manually walked through the full checkout flow in a local browser session.',
          unverifiedItems: ['Mobile Safari not tested', 'Payment webhook not exercised'],
        },
      })
    );
    expect(result.decision).toBe('PASS');
  });
});

describe('runSupervisor — launch-critical gate wired into the real completion pipeline', () => {
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
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-verification-gate-'));
    wrapperDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-verification-gate-wrappers-'));

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

  it('a non-launch-critical task reaches DONE exactly as before, with tests passing and no evidence recorded', async () => {
    const task = createTask({
      title: 'Ordinary task, unaffected by the new gate',
      goal: 'Stay in scope',
      priority: 'HIGH',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['note.txt'],
      testsRequired: [],
      root: repoDir,
    });

    const agy = script('agy-ok.sh', `printf 'note\n' > note.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agy },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 5,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('NO_MORE_READY_TASKS');
    expect(getTask(task.taskId, repoDir)?.status).toBe('DONE');
  });

  it('a launch-critical task with no verificationEvidence cannot reach DONE via the real pipeline, even though tests/build pass', async () => {
    const task = createTask({
      title: 'Launch-critical task without evidence',
      goal: 'Must not silently reach DONE',
      priority: 'CRITICAL',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      fallbackAgent1: 'CLAUDE',
      fallbackAgent2: 'ASTRA',
      writeScope: ['note.txt'],
      testsRequired: [],
      launchCritical: true,
      root: repoDir,
    });

    // Every candidate agent produces a perfectly valid, in-scope, test-passing
    // change — but none of them ever records verificationEvidence, so the
    // task must never reach DONE.
    const agentScript = (name: string) => script(name, `printf 'note\n' > note.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agentScript('agy.sh'), CLAUDE: agentScript('claude.sh'), ASTRA: agentScript('astra.sh') },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 10,
      perTaskTimeoutMs: 5_000,
    });

    const updated = getTask(task.taskId, repoDir)!;
    expect(updated.status).not.toBe('DONE');
    expect(updated.currentCommit).toBeFalsy();
    expect(updated.attempts.some((a) => a.outcome === 'FAILED' && /verificationEvidence/i.test(a.whyFailed ?? ''))).toBe(true);
    // The working tree was left clean — the unverified change was salvaged, not committed.
    expect(git(['status', '--short']).trim()).toBe('');
    expect(git(['log', '--oneline']).split('\n').filter(Boolean)).toHaveLength(1); // init only, no task commit ever landed
  });

  it('a launch-critical task with real evidence recorded ahead of time reaches DONE', async () => {
    const task = createTask({
      title: 'Launch-critical task with evidence',
      goal: 'Should reach DONE once verification evidence is present',
      priority: 'CRITICAL',
      phase: 'PHASE_1_RECON',
      primaryAgent: 'AGY',
      writeScope: ['note.txt'],
      testsRequired: [],
      launchCritical: true,
      verificationEvidence: {
        exercisedFlow: 'Started dev server, registered a test player, completed the flow in browser, confirmed the result.',
        unverifiedItems: [],
      },
      root: repoDir,
    });

    const agy = script('agy-ok.sh', `printf 'note\n' > note.txt`);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agy },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 5,
      perTaskTimeoutMs: 5_000,
    });

    expect(result.stopReason).toBe('NO_MORE_READY_TASKS');
    expect(getTask(task.taskId, repoDir)?.status).toBe('DONE');
  });
});
