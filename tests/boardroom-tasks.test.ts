// Canton Quests Boardroom V2 — task ledger tests.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask, getTask, listTasks, updateTaskStatus, setConfidence, recordDecision, recordFilesTouched, recordTestResult, addBlocker, setCurrentCommit, checkpoint } from '../lib/boardroom/tasks';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-tasks-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function baseTask(overrides: Partial<Parameters<typeof createTask>[0]> = {}) {
  return createTask({
    title: 'Test task',
    goal: 'Do the thing',
    priority: 'MEDIUM',
    phase: 'PHASE_1_RECON',
    primaryAgent: 'CLAUDE',
    root,
    ...overrides,
  });
}

describe('createTask / getTask / listTasks', () => {
  it('creates a task with sane defaults', () => {
    const task = baseTask();
    expect(task.status).toBe('QUEUED');
    expect(task.confidence).toBe('ASSUMPTION');
    expect(task.writeScope).toEqual([]);
    expect(task.decisions).toEqual([]);
    expect(getTask(task.taskId, root)).toEqual(task);
  });

  it('returns null for an unknown task', () => {
    expect(getTask('TASK-does-not-exist', root)).toBeNull();
  });

  it('lists tasks ordered by createdAt', () => {
    const t1 = baseTask({ title: 'First' });
    const t2 = baseTask({ title: 'Second', taskId: `${t1.taskId}-x` });
    const listed = listTasks(root);
    expect(listed.map((t) => t.taskId)).toEqual([t1.taskId, t2.taskId]);
  });

  it('preserves an explicitly declared writeScope and category', () => {
    const task = baseTask({ writeScope: ['app/foo/', 'lib/bar.ts'], category: 'ROUTINE_IMPLEMENTATION' });
    expect(task.writeScope).toEqual(['app/foo/', 'lib/bar.ts']);
    expect(task.category).toBe('ROUTINE_IMPLEMENTATION');
  });
});

describe('mutators', () => {
  it('updateTaskStatus changes status and bumps updatedAt', () => {
    const task = baseTask();
    const before = task.updatedAt;
    const updated = updateTaskStatus(task.taskId, 'ACTIVE', root);
    expect(updated.status).toBe('ACTIVE');
    expect(updated.updatedAt >= before).toBe(true);
  });

  it('setConfidence updates confidence', () => {
    const task = baseTask();
    const updated = setConfidence(task.taskId, 'VERIFIED', root);
    expect(updated.confidence).toBe('VERIFIED');
  });

  it('recordDecision appends with a timestamp', () => {
    const task = baseTask();
    const updated = recordDecision(task.taskId, { by: 'DUSTIN', summary: 'Use approach X' }, root);
    expect(updated.decisions).toHaveLength(1);
    expect(updated.decisions[0].summary).toBe('Use approach X');
    expect(typeof updated.decisions[0].at).toBe('string');
  });

  it('recordFilesTouched de-duplicates across calls', () => {
    const task = baseTask();
    recordFilesTouched(task.taskId, ['a.ts', 'b.ts'], root);
    const updated = recordFilesTouched(task.taskId, ['b.ts', 'c.ts'], root);
    expect(updated.filesTouched.sort()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('recordTestResult tracks a failure in knownFailures', () => {
    const task = baseTask();
    const updated = recordTestResult(task.taskId, { command: 'npm test', passed: false, summary: '3 failing' }, root);
    expect(updated.testResults).toHaveLength(1);
    expect(updated.knownFailures).toEqual(['npm test: 3 failing']);
  });

  it('recordTestResult on a pass does not add a knownFailure', () => {
    const task = baseTask();
    const updated = recordTestResult(task.taskId, { command: 'npm test', passed: true, summary: 'ok' }, root);
    expect(updated.knownFailures).toEqual([]);
  });

  it('addBlocker de-duplicates identical blockers', () => {
    const task = baseTask();
    addBlocker(task.taskId, 'Waiting on X', root);
    const updated = addBlocker(task.taskId, 'Waiting on X', root);
    expect(updated.blockers).toEqual(['Waiting on X']);
  });

  it('setCurrentCommit sets startingCommit on the first call only', () => {
    const task = baseTask();
    const first = setCurrentCommit(task.taskId, 'commit1', root);
    expect(first.startingCommit).toBe('commit1');
    expect(first.currentCommit).toBe('commit1');
    const second = setCurrentCommit(task.taskId, 'commit2', root);
    expect(second.startingCommit).toBe('commit1');
    expect(second.currentCommit).toBe('commit2');
  });

  it('checkpoint writes summary/remainingWork and defaults status to CHECKPOINTED', () => {
    const task = baseTask();
    const updated = checkpoint(task.taskId, { summary: 'Did X', remainingWork: 'Do Y next' }, root);
    expect(updated.checkpointSummary).toBe('Did X');
    expect(updated.remainingWork).toBe('Do Y next');
    expect(updated.status).toBe('CHECKPOINTED');
  });

  it('checkpoint accepts an explicit status override', () => {
    const task = baseTask();
    const updated = checkpoint(task.taskId, { summary: 'Done', remainingWork: 'None', status: 'DONE' }, root);
    expect(updated.status).toBe('DONE');
  });

  it('mutating an unknown task throws', () => {
    expect(() => updateTaskStatus('TASK-nope', 'ACTIVE', root)).toThrow(/not found/);
  });
});
