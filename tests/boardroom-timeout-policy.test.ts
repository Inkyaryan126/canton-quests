// Canton Quests Boardroom V2 — task-class-aware timeout policy tests.
//
// Motivated by the real Phase 2 run where all three CINEMATIC_UX_SYSTEM
// tasks (zvme, 3kic, 96yy) ended BLOCKED: Claude's own generation alone ran
// 646-1154s against a flat 1200s ceiling, and Agy (the last-resort fallback
// for the same Astra-worthy work) hit exactly 1200s on every attempt with
// little to no salvageable output. resolveTaskTimeoutMs() gives Astra-worthy
// categories a larger budget scaled off the caller's configured default
// (not a hardcoded absolute number, so tests can exercise the real
// multiplier/cap logic with sub-second timeouts), with an explicit upper
// bound so no task can occupy the write lock indefinitely.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveTaskTimeoutMs, runSupervisor, type GitOps } from '../lib/boardroom/supervisor';
import { createTask, getTask } from '../lib/boardroom/tasks';
import type { Task } from '../lib/boardroom/types';

function baseTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    taskId: 'TASK-X',
    title: 'T',
    goal: 'G',
    priority: 'HIGH',
    phase: 'PHASE_2_CORE_EXPERIENCE_SYSTEM',
    primaryAgent: 'ASTRA',
    status: 'QUEUED',
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

describe('resolveTaskTimeoutMs (unit)', () => {
  it('leaves the configured default unchanged for a task with no category', () => {
    const task = baseTask({ category: undefined });
    expect(resolveTaskTimeoutMs(task, 20 * 60 * 1000)).toBe(20 * 60 * 1000);
  });

  it('leaves the configured default unchanged for a non-Astra-worthy category', () => {
    const task = baseTask({ category: 'ROUTINE_IMPLEMENTATION' });
    expect(resolveTaskTimeoutMs(task, 20 * 60 * 1000)).toBe(20 * 60 * 1000);
  });

  it('doubles the configured default for an Astra-worthy category', () => {
    const task = baseTask({ category: 'CINEMATIC_UX_SYSTEM' });
    expect(resolveTaskTimeoutMs(task, 20 * 60 * 1000)).toBe(40 * 60 * 1000);
  });

  it('matches the real-world default: 1200s -> 2400s for a complex category', () => {
    const task = baseTask({ category: 'FLAGSHIP_MOMENT' });
    expect(resolveTaskTimeoutMs(task, 1200_000)).toBe(2400_000);
  });

  it('never exceeds the explicit upper bound, even for a large configured default', () => {
    const task = baseTask({ category: 'FINAL_INTEGRATION' });
    // 2x a huge default would be 200 minutes — must still be capped.
    const huge = 100 * 60 * 1000;
    expect(resolveTaskTimeoutMs(task, huge)).toBe(45 * 60 * 1000);
  });

  it('the upper bound also applies to a non-complex task given a default already above it', () => {
    const task = baseTask({ category: undefined });
    const aboveCap = 60 * 60 * 1000;
    expect(resolveTaskTimeoutMs(task, aboveCap)).toBe(45 * 60 * 1000);
  });

  it.each(['EXPERIENTIAL_ARCHITECTURE', 'CINEMATIC_UX_SYSTEM', 'MAJOR_CROSS_COMPONENT', 'DIFFICULT_BUG', 'FLAGSHIP_MOMENT', 'FINAL_INTEGRATION', 'FINAL_POLISH', 'HARD_ARCHITECTURAL_DECISION'])(
    'treats %s as Astra-worthy/complex',
    (category) => {
      const task = baseTask({ category });
      expect(resolveTaskTimeoutMs(task, 1000)).toBe(2000);
    }
  );

  it.each(['ROUTINE_IMPLEMENTATION', 'REPETITIVE_EDIT', 'BASIC_TEST_WRITING', 'CSS_CLEANUP', 'REPO_RECON', 'CODE_REVIEW'])(
    'does not treat %s as complex',
    (category) => {
      const task = baseTask({ category });
      expect(resolveTaskTimeoutMs(task, 1000)).toBe(1000);
    }
  );
});

describe('resolveTaskTimeoutMs wired into runSupervisor (integration)', () => {
  let repoDir: string;
  let wrapperDir: string;

  function git(args: string[]): string {
    return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' });
  }
  function gitOps(): GitOps {
    return { run: git };
  }
  function sleepyScript(name: string, sleepMs: number): string {
    const p = path.join(wrapperDir, name);
    // Touches its declared scope file AFTER sleeping, so a run that beats the
    // timeout produces a clean, unambiguous success (committed), rather than
    // an ambiguous "no changes" outcome that would itself get task-locally
    // failed over regardless of timing.
    fs.writeFileSync(p, `#!/bin/sh\nsleep ${(sleepMs / 1000).toFixed(3)}\nprintf 'done\\n' > note.txt\n`, { mode: 0o755 });
    return p;
  }

  beforeEach(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-timeout-'));
    wrapperDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-timeout-wrappers-'));
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

  it('a plain (non-complex) task times out at the configured default', async () => {
    const task = createTask({ title: 'Plain', goal: 'G', priority: 'HIGH', phase: 'PHASE_4_SECONDARY_POLISH', primaryAgent: 'AGY', writeScope: ['note.txt'], testsRequired: [], root: repoDir });
    const agy = sleepyScript('agy-slow.sh', 1000);

    await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { AGY: agy },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 3,
      perTaskTimeoutMs: 600, // deliberately shorter than the 1000ms sleep
    });

    const updated = getTask(task.taskId, repoDir)!;
    // Timed out -> task-local failover -> no fallback distinct from AGY itself -> BLOCKED.
    expect(updated.attempts.some((a) => /timed out/i.test(a.approachSummary))).toBe(true);
  });

  it('an Astra-worthy (complex) task survives the SAME duration that would time out a plain task', async () => {
    const task = createTask({
      title: 'Complex',
      goal: 'G',
      priority: 'HIGH',
      phase: 'PHASE_2_CORE_EXPERIENCE_SYSTEM',
      primaryAgent: 'AGY',
      // Setting `category` opts this task into DYNAMIC routing (see
      // resolveAssignment in supervisor.ts), which overrides primaryAgent
      // and tries ASTRA first regardless — so every agent must point at the
      // same sleepy script; the test cares about the timeout budget, not
      // which of the three ends up running.
      category: 'CINEMATIC_UX_SYSTEM',
      writeScope: ['note.txt'],
      testsRequired: [],
      root: repoDir,
    });
    const sleepy = sleepyScript('agy-slow-complex.sh', 1000);

    const result = await runSupervisor({
      root: repoDir,
      git: gitOps(),
      binaryOverrides: { ASTRA: sleepy, CLAUDE: sleepy, AGY: sleepy },
      registerProcessHandlers: false,
      startSleepPrevention: () => ({ active: false, reason: 'test' }),
      maxIterations: 3,
      perTaskTimeoutMs: 600, // 2x = 1200ms effective budget for this category, comfortably above the 1000ms sleep
    });

    const updated = getTask(task.taskId, repoDir)!;
    expect(updated.attempts.some((a) => /timed out/i.test(a.approachSummary))).toBe(false);
    expect(result.stopReason).toBe('NO_MORE_READY_TASKS');
  });
});
