/**
 * Canton Quests Boardroom V2 — launch-critical verification gate.
 *
 * Purely additive and opt-in (see boardroom/BOARDROOM.md's "Launch-critical
 * verification gate" section): `task.launchCritical` defaults to
 * undefined/false, and this gate always PASSes for such a task — no
 * existing or currently in-flight task in another worktree is affected
 * unless it explicitly sets the flag.
 *
 * Rationale: TESTS_REQUIRED passing (automated command exit codes, see
 * commitGate.ts and supervisor.ts) is not the same thing as a human or
 * agent having actually exercised the feature. For a task opted into
 * `launchCritical`, this gate additionally requires an honest, explicit
 * record of what was functionally verified and what was not — matching the
 * "no false claims" spirit of BOARDROOM.md's honesty rules, in particular
 * rule 4 ("confidence states must never silently upgrade"). A pure
 * decision function, no side effects — mirrors commitGate.ts's
 * evaluateChangedPaths shape.
 */
import type { Task } from './types';

export interface VerificationGateResult {
  decision: 'PASS' | 'BLOCK';
  reason?: string;
}

// Guards against an agent satisfying the letter of the check with a
// throwaway placeholder ("n/a", "todo", "...") instead of a real,
// human-readable account of what was exercised.
const PLACEHOLDER_PATTERN = /^(n\/?a|none|todo|tbd|pending|xxx+|\.+|-+)$/i;

function isRealExercisedFlow(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 10) return false;
  if (PLACEHOLDER_PATTERN.test(trimmed)) return false;
  return true;
}

/**
 * Given a task, decides whether it may proceed to DONE. Called from
 * supervisor.ts in the same structural position as the existing
 * TESTS_REQUIRED check — after tests pass, before staging/commit — so a
 * BLOCK here is recorded as a failed attempt exactly like a test failure,
 * subject to the same two-failed-attempt rule (attempts.ts).
 */
export function evaluateVerification(task: Task): VerificationGateResult {
  if (!task.launchCritical) return { decision: 'PASS' };

  const evidence = task.verificationEvidence;
  if (!evidence) {
    return {
      decision: 'BLOCK',
      reason:
        'Task is launchCritical but has no verificationEvidence recorded. Automated TESTS_REQUIRED commands passing is not sufficient evidence for a launch-critical task — a genuinely exercised functional flow must be recorded before DONE.',
    };
  }
  if (!isRealExercisedFlow(evidence.exercisedFlow)) {
    return {
      decision: 'BLOCK',
      reason: `Task is launchCritical but verificationEvidence.exercisedFlow is missing, empty, or a placeholder ("${evidence.exercisedFlow ?? ''}"). Describe concretely what was manually/functionally verified and how.`,
    };
  }
  if (!Array.isArray(evidence.unverifiedItems)) {
    return {
      decision: 'BLOCK',
      reason:
        'Task is launchCritical but verificationEvidence.unverifiedItems is missing. It must be present (an array, possibly empty) so nothing left unverified is silently omitted.',
    };
  }
  return { decision: 'PASS' };
}
