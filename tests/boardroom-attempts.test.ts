// Canton Quests Boardroom V2 — two-failed-attempt rule tests.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask } from '../lib/boardroom/tasks';
import { recordAttempt, checkThreshold } from '../lib/boardroom/attempts';

let root: string;
let taskId: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-attempts-'));
  const task = createTask({ title: 'T', goal: 'G', priority: 'MEDIUM', phase: 'PHASE_1_RECON', primaryAgent: 'CLAUDE', root });
  taskId = task.taskId;
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('checkThreshold', () => {
  it('returns null with zero or one failed attempt', () => {
    expect(checkThreshold(taskId, root)).toBeNull();
    recordAttempt(taskId, { agent: 'CLAUDE', approachSummary: 'Tried patching the regex validator directly', outcome: 'FAILED' }, root);
    expect(checkThreshold(taskId, root)).toBeNull();
  });

  it('returns null when two failures use meaningfully different approaches', () => {
    recordAttempt(taskId, { agent: 'CLAUDE', approachSummary: 'Tried patching the regex validator directly', outcome: 'FAILED' }, root);
    recordAttempt(taskId, { agent: 'AGY', approachSummary: 'Rewrote the auth middleware from scratch using JWT', outcome: 'FAILED' }, root);
    expect(checkThreshold(taskId, root)).toBeNull();
  });

  it('returns a forced action once substantially the same approach fails twice, across agents', () => {
    recordAttempt(taskId, { agent: 'CLAUDE', approachSummary: 'Patch the regex validator to allow trailing slashes', outcome: 'FAILED', whyFailed: 'Broke an existing test' }, root);
    recordAttempt(taskId, { agent: 'AGY', approachSummary: 'Patch the regex validator to allow trailing slashes again', outcome: 'FAILED', whyFailed: 'Same test still broke' }, root);
    const forced = checkThreshold(taskId, root);
    expect(forced).not.toBeNull();
    expect(forced?.options).toContain('CHANGE_APPROACH');
    expect(forced?.options).not.toContain('RETRY_UNCHANGED' as any);
    expect(forced?.priorAttempts).toHaveLength(2);
  });

  it('a SUCCEEDED attempt does not count toward the threshold', () => {
    recordAttempt(taskId, { agent: 'CLAUDE', approachSummary: 'Patch the regex validator to allow trailing slashes', outcome: 'FAILED' }, root);
    recordAttempt(taskId, { agent: 'AGY', approachSummary: 'Patch the regex validator to allow trailing slashes', outcome: 'SUCCEEDED' }, root);
    expect(checkThreshold(taskId, root)).toBeNull();
  });

  it('ignores very short overlapping fragments (avoids false positives on trivial similarity)', () => {
    recordAttempt(taskId, { agent: 'CLAUDE', approachSummary: 'Fix it', outcome: 'FAILED' }, root);
    recordAttempt(taskId, { agent: 'AGY', approachSummary: 'Fix it differently with a whole new strategy', outcome: 'FAILED' }, root);
    expect(checkThreshold(taskId, root)).toBeNull();
  });

  it('recordAttempt throws for an unknown task', () => {
    expect(() => recordAttempt('TASK-nope', { agent: 'CLAUDE', approachSummary: 'x', outcome: 'FAILED' }, root)).toThrow(/not found/);
  });
});
