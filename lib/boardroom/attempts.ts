/**
 * Canton Quests Boardroom V2 — the two-failed-attempt rule.
 *
 * If substantially the same approach fails twice, do not attempt it a
 * third time unchanged (AGENTS.md Rule 12 already says this for a single
 * agent's own debugging; this generalizes it across the whole Boardroom so
 * a *different* agent inheriting the task doesn't quietly repeat the same
 * failed approach either — both attempts are recorded on the task so the
 * next agent starts already knowing what didn't work).
 */
import { getTask } from './tasks';
import { taskFile } from './paths';
import { writeJsonAtomic } from './atomicFile';
import type { Attempt, AgentName } from './types';

export type ForcedActionOption = 'DIAGNOSE_ROOT_CAUSE' | 'CHANGE_APPROACH' | 'REDUCE_SCOPE' | 'REQUEST_PEER_REVIEW' | 'HANDOFF';

export interface ForcedAction {
  reason: string;
  priorAttempts: [Attempt, Attempt];
  options: ForcedActionOption[];
}

/** Normalizes an approach description for fuzzy same-approach matching (case/whitespace-insensitive substring overlap). */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isSameApproach(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Substantial overlap in either direction counts as "substantially the same approach".
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  return longer.includes(shorter) && shorter.length >= 12;
}

export function recordAttempt(
  taskId: string,
  attempt: { agent: AgentName; approachSummary: string; outcome: Attempt['outcome']; whyFailed?: string },
  root?: string
): void {
  const task = getTask(taskId, root);
  if (!task) throw new Error(`Boardroom task not found: ${taskId}`);
  task.attempts.push({ ...attempt, at: new Date().toISOString() });
  task.updatedAt = new Date().toISOString();
  writeJsonAtomic(taskFile(taskId, root), task);
}

/**
 * Returns the forced action once the same approach has failed twice on
 * this task, across any agent. Returns null while there's no such
 * pattern yet — callers should keep letting the current agent proceed.
 */
export function checkThreshold(taskId: string, root?: string): ForcedAction | null {
  const task = getTask(taskId, root);
  if (!task) return null;
  const failed = task.attempts.filter((a) => a.outcome === 'FAILED');
  for (let i = 0; i < failed.length; i++) {
    for (let j = i + 1; j < failed.length; j++) {
      if (isSameApproach(failed[i].approachSummary, failed[j].approachSummary)) {
        return {
          reason: `Same approach failed twice: "${failed[i].approachSummary}" and "${failed[j].approachSummary}"`,
          priorAttempts: [failed[i], failed[j]],
          // Boardroom's own forced menu — deliberately not "retry unchanged".
          options: ['DIAGNOSE_ROOT_CAUSE', 'CHANGE_APPROACH', 'REDUCE_SCOPE', 'REQUEST_PEER_REVIEW', 'HANDOFF'],
        };
      }
    }
  }
  return null;
}
