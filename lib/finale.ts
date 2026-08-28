/**
 * Canton Quests — Founder's Cipher Convergence / Master Finale
 * =================================================================
 * Pure types and decision logic. The final answer itself is never a value
 * that exists in this file — every function here either takes an
 * already-fetched hash to compare against (server-side only) or works
 * entirely from counts/booleans. No fake/placeholder answer is defined
 * anywhere; an unconfigured finale (finalAnswerHash: null) is simply not
 * completable yet, by construction (submitFinaleAnswer below returns
 * 'not_configured' rather than ever comparing against a made-up value).
 */

import { proofMatches } from './quest-proof-secrets';

export type ConvergenceStage = 'no_sigils' | 'one_sigil' | 'two_sigils' | 'convergence_ready';

/** Any district order works — this only ever counts, never checks which specific districts. */
export function getConvergenceStage(unlockedSigilCount: number): ConvergenceStage {
  if (unlockedSigilCount >= 3) return 'convergence_ready';
  if (unlockedSigilCount === 2) return 'two_sigils';
  if (unlockedSigilCount === 1) return 'one_sigil';
  return 'no_sigils';
}

export interface FinaleConfig {
  eventId: string;
  requiredSigilCount: number;
  requiresWatcherEligibility: boolean;
  masterCipherCluePieces: string[];
  finalAnswerHash: string | null;
  finalDestinationReveal: string | null;
  opensAt: string | null;
  closesAt: string | null;
  falseFinaleEnabled: boolean;
  falseFinaleAnswerHash: string | null;
  falseFinaleRevealText: string | null;
}

export type FinaleEligibility =
  | { ok: true }
  | { ok: false; reason: 'insufficient_sigils' | 'watcher_required' | 'not_configured' | 'not_yet_open' | 'closed' | 'event_ended'; message: string };

/**
 * Full eligibility check — sigil count (any order, count only), optional
 * Watcher requirement, the configured open/close window (server time,
 * injectable `now`), and whether the event itself has ended. A finale with
 * no configured answer is never "eligible" to submit against, regardless
 * of sigil count — there's nothing to check the answer against yet.
 */
export function checkFinaleEligibility(
  config: FinaleConfig | null,
  unlockedSigilCount: number,
  isWatcherEligible: boolean,
  eventEnded: boolean,
  now: Date = new Date()
): FinaleEligibility {
  if (!config || !config.finalAnswerHash) {
    return { ok: false, reason: 'not_configured', message: 'The Master Cipher has not been configured for this Mission yet.' };
  }
  if (eventEnded) {
    return { ok: false, reason: 'event_ended', message: 'This Mission has ended.' };
  }
  const nowMs = now.getTime();
  if (config.opensAt && new Date(config.opensAt).getTime() > nowMs) {
    return { ok: false, reason: 'not_yet_open', message: 'The Master Cipher has not opened yet.' };
  }
  if (config.closesAt && new Date(config.closesAt).getTime() <= nowMs) {
    return { ok: false, reason: 'closed', message: 'The Master Cipher window has closed.' };
  }
  if (unlockedSigilCount < config.requiredSigilCount) {
    return { ok: false, reason: 'insufficient_sigils', message: `You need ${config.requiredSigilCount} district sigils to attempt convergence — you have ${unlockedSigilCount}.` };
  }
  if (config.requiresWatcherEligibility && !isWatcherEligible) {
    return { ok: false, reason: 'watcher_required', message: 'This convergence requires a Watcher signal you have not yet received.' };
  }
  return { ok: true };
}

export type FinaleSubmissionOutcome =
  | { stage: 'false_finale_solved'; revealText: string | null }
  | { stage: 'completed'; destinationReveal: string | null }
  | { stage: 'already_completed'; destinationReveal: string | null }
  | { stage: 'incorrect' };

/**
 * Pure answer-checking logic, given an already-eligible player's current
 * progress and the (server-fetched) config hashes. Reuses proofMatches —
 * the same sha256:-prefixed comparison already trusted for quest answers —
 * rather than a second hashing scheme. Idempotent: a player who has
 * already completed resolves to 'already_completed' without re-checking
 * the answer at all, so a duplicate correct (or now-changed) submission
 * can never un-complete or double-grant anything.
 */
export function evaluateFinaleSubmission(
  config: FinaleConfig,
  progress: { falseFinaleSolvedAt: string | null; completedAt: string | null },
  submittedAnswer: string
): FinaleSubmissionOutcome {
  if (progress.completedAt) {
    return { stage: 'already_completed', destinationReveal: config.finalDestinationReveal };
  }

  if (config.falseFinaleEnabled && !progress.falseFinaleSolvedAt && config.falseFinaleAnswerHash && proofMatches(submittedAnswer, config.falseFinaleAnswerHash)) {
    return { stage: 'false_finale_solved', revealText: config.falseFinaleRevealText };
  }

  // The real answer only completes the finale once any required false-finale stage has actually been passed.
  const falseFinaleGatePassed = !config.falseFinaleEnabled || !!progress.falseFinaleSolvedAt;
  if (falseFinaleGatePassed && config.finalAnswerHash && proofMatches(submittedAnswer, config.finalAnswerHash)) {
    return { stage: 'completed', destinationReveal: config.finalDestinationReveal };
  }

  return { stage: 'incorrect' };
}
