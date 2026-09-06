/**
 * Canton Quests Boardroom V2 — single-writer lock.
 *
 * Cooperative, not OS-enforced: this only governs invocations that go
 * through the Boardroom supervisor. It cannot stop a hand-driven fourth
 * terminal from editing the repo (see boardroom/BOARDROOM.md). What it DOES
 * guarantee is that the supervisor itself never lets two agent turns run
 * concurrently, and that a lock left behind by a crashed process can be
 * recovered deliberately instead of wedging the repo forever.
 */
import { lockFile } from './paths';
import { readJsonIfExists, writeJsonAtomic, removeIfExists } from './atomicFile';
import type { AgentName, WriteLock } from './types';

export class LockHeldByAnotherAgentError extends Error {
  constructor(public readonly lock: WriteLock) {
    super(`Write lock is already held by ${lock.holder} for task ${lock.taskId} (pid ${lock.pid}).`);
    this.name = 'LockHeldByAnotherAgentError';
  }
}

export class NotLockHolderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotLockHolderError';
  }
}

/** True if a process with this PID currently exists. Never sends a real signal (signal 0). */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code !== 'ESRCH' ? true : false;
  }
}

export function getLock(root?: string): WriteLock | null {
  return readJsonIfExists<WriteLock>(lockFile(root));
}

/**
 * Acquires the lock for `holder`/`taskId`. Throws LockHeldByAnotherAgentError
 * if a different agent currently holds it (even if that lock is stale —
 * callers must explicitly recoverStale() first, so recovery is always a
 * deliberate, logged decision, never implicit).
 */
export function acquireLock(params: {
  holder: AgentName;
  taskId: string;
  startingCommit: string;
  pid?: number;
  note?: string;
  root?: string;
}): WriteLock {
  const existing = getLock(params.root);
  if (existing && existing.holder !== params.holder) {
    throw new LockHeldByAnotherAgentError(existing);
  }
  const lock: WriteLock = {
    holder: params.holder,
    taskId: params.taskId,
    startingCommit: params.startingCommit,
    acquiredAt: new Date().toISOString(),
    pid: params.pid ?? process.pid,
    note: params.note,
  };
  writeJsonAtomic(lockFile(params.root), lock);
  return lock;
}

/** Releases the lock. Requires proof of holdership (agent + taskId) so a task can never release someone else's lease. */
export function releaseLock(params: { holder: AgentName; taskId: string; root?: string }): void {
  const existing = getLock(params.root);
  if (!existing) return;
  if (existing.holder !== params.holder || existing.taskId !== params.taskId) {
    throw new NotLockHolderError(
      `Cannot release lock: held by ${existing.holder}/${existing.taskId}, not ${params.holder}/${params.taskId}.`
    );
  }
  removeIfExists(lockFile(params.root));
}

export interface StaleLockAssessment {
  lock: WriteLock;
  holderPidAlive: boolean;
  ageMs: number;
  /** Safe to auto-recover: holder PID is confirmed dead. */
  safeToAutoRecover: boolean;
}

export function assessStaleLock(root?: string): StaleLockAssessment | null {
  const lock = getLock(root);
  if (!lock) return null;
  const holderPidAlive = isProcessAlive(lock.pid);
  const ageMs = Date.now() - new Date(lock.acquiredAt).getTime();
  return { lock, holderPidAlive, ageMs, safeToAutoRecover: !holderPidAlive };
}

/**
 * Recovers a stale lock. If the holder's PID is dead, recovery proceeds
 * regardless of age (Scenario I: CLI crashed while holding the writer
 * lock). If the PID is still alive, recovery requires `force: true` — a
 * still-alive holder might just be a long-running task, so this path is
 * for deliberate human/operator override only, and the reason is required
 * so it ends up in the record.
 */
export function recoverStaleLock(params: { force?: boolean; reason?: string; root?: string } = {}): {
  recovered: boolean;
  assessment: StaleLockAssessment | null;
} {
  const assessment = assessStaleLock(params.root);
  if (!assessment) return { recovered: false, assessment: null };

  if (assessment.safeToAutoRecover || params.force) {
    removeIfExists(lockFile(params.root));
    return { recovered: true, assessment };
  }
  return { recovered: false, assessment };
}
