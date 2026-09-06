// Canton Quests Boardroom V2 — write-lock tests.
//
// Every test runs against a throwaway temp directory (never the real
// .boardroom/runtime/) so this suite can never corrupt or race with real
// Boardroom state.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquireLock, releaseLock, getLock, assessStaleLock, recoverStaleLock, isProcessAlive, LockHeldByAnotherAgentError, NotLockHolderError } from '../lib/boardroom/lock';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-lock-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('isProcessAlive', () => {
  it('returns true for the current process', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('returns false for a PID that does not exist', () => {
    // A PID astronomically unlikely to exist on any real system.
    expect(isProcessAlive(999_999)).toBe(false);
  });
});

describe('acquireLock / releaseLock', () => {
  it('acquires when no lock exists', () => {
    const lock = acquireLock({ holder: 'CLAUDE', taskId: 'TASK-1', startingCommit: 'abc123', root });
    expect(lock.holder).toBe('CLAUDE');
    expect(getLock(root)).toEqual(lock);
  });

  it('throws LockHeldByAnotherAgentError when a different agent holds it', () => {
    acquireLock({ holder: 'CLAUDE', taskId: 'TASK-1', startingCommit: 'abc123', root });
    expect(() => acquireLock({ holder: 'AGY', taskId: 'TASK-2', startingCommit: 'abc123', root })).toThrow(LockHeldByAnotherAgentError);
  });

  it('re-acquiring for the same holder overwrites (idempotent re-entry)', () => {
    acquireLock({ holder: 'CLAUDE', taskId: 'TASK-1', startingCommit: 'abc123', root });
    const second = acquireLock({ holder: 'CLAUDE', taskId: 'TASK-1', startingCommit: 'def456', root });
    expect(second.startingCommit).toBe('def456');
  });

  it('releases cleanly when the releaser is the actual holder', () => {
    acquireLock({ holder: 'CLAUDE', taskId: 'TASK-1', startingCommit: 'abc123', root });
    releaseLock({ holder: 'CLAUDE', taskId: 'TASK-1', root });
    expect(getLock(root)).toBeNull();
  });

  it('releasing with no lock present is a harmless no-op', () => {
    expect(() => releaseLock({ holder: 'CLAUDE', taskId: 'TASK-1', root })).not.toThrow();
  });

  it('throws NotLockHolderError when a non-holder tries to release', () => {
    acquireLock({ holder: 'CLAUDE', taskId: 'TASK-1', startingCommit: 'abc123', root });
    expect(() => releaseLock({ holder: 'AGY', taskId: 'TASK-1', root })).toThrow(NotLockHolderError);
    expect(getLock(root)).not.toBeNull(); // still held — nothing was released
  });
});

describe('assessStaleLock / recoverStaleLock', () => {
  it('returns null when no lock exists', () => {
    expect(assessStaleLock(root)).toBeNull();
    expect(recoverStaleLock({ root })).toEqual({ recovered: false, assessment: null });
  });

  it('a lock held by a dead PID is safe to auto-recover regardless of age', () => {
    acquireLock({ holder: 'ASTRA', taskId: 'TASK-1', startingCommit: 'abc123', pid: 999_999, root });
    const assessment = assessStaleLock(root);
    expect(assessment?.holderPidAlive).toBe(false);
    expect(assessment?.safeToAutoRecover).toBe(true);

    const result = recoverStaleLock({ root });
    expect(result.recovered).toBe(true);
    expect(getLock(root)).toBeNull();
  });

  it('a lock held by a live PID is NOT auto-recovered without force', () => {
    acquireLock({ holder: 'ASTRA', taskId: 'TASK-1', startingCommit: 'abc123', pid: process.pid, root });
    const assessment = assessStaleLock(root);
    expect(assessment?.holderPidAlive).toBe(true);
    expect(assessment?.safeToAutoRecover).toBe(false);

    const result = recoverStaleLock({ root });
    expect(result.recovered).toBe(false);
    expect(getLock(root)).not.toBeNull();
  });

  it('a lock held by a live PID CAN be force-recovered deliberately', () => {
    acquireLock({ holder: 'ASTRA', taskId: 'TASK-1', startingCommit: 'abc123', pid: process.pid, root });
    const result = recoverStaleLock({ force: true, reason: 'manual override for test', root });
    expect(result.recovered).toBe(true);
    expect(getLock(root)).toBeNull();
  });
});
