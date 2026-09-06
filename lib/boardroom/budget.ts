/**
 * Canton Quests Boardroom V2 — Astra usage conservation.
 *
 * Astra's remaining allowance is SELF-REPORTED, never auto-detected: no
 * CLI/API exposes it (verified against `codex --help` / `codex exec --help`
 * / `codex doctor --help` — see boardroom/BOARDROOM.md for the full
 * finding). This module turns a self-reported percentage into a routing
 * policy, and turns the two reset credits into a strictly human-confirmed
 * counter that can never be incremented by inference.
 */
import { budgetFile } from './paths';
import { readJsonIfExists, writeJsonAtomic } from './atomicFile';
import type { AstraBudgetState, AstraBudgetTier, AgentName } from './types';

const DEFAULT_STATE: AstraBudgetState = {
  allowanceRemainingPct: null,
  tier: 'NORMAL',
  resetCreditsTotal: 2,
  resetCreditsUsed: 0,
  lastSelfReportedAt: null,
  lastSelfReportedBy: null,
  resetHistory: [],
};

export function getBudgetState(root?: string): AstraBudgetState {
  return readJsonIfExists<AstraBudgetState>(budgetFile(root)) ?? { ...DEFAULT_STATE, resetHistory: [] };
}

/** Pure classification: >70 NORMAL, 50-70 CONSERVE, 30-50 RESERVE, <30 CRITICAL (Section 6). */
export function classifyTier(pct: number): AstraBudgetTier {
  if (pct > 70) return 'NORMAL';
  if (pct >= 50) return 'CONSERVE';
  if (pct >= 30) return 'RESERVE';
  return 'CRITICAL';
}

export interface RoutingGuidance {
  tier: AstraBudgetTier;
  astraMayDoArchitecture: boolean;
  astraMayDoRoutineImplementation: boolean;
  delegateRoutineWorkAway: boolean;
  protectFinalIntegrationReserve: boolean;
  note: string;
}

/**
 * Given a tier, what should Astra be allowed to do right now. Does not
 * consult a task at all — routing.ts combines this with task-level
 * Astra-worthiness (Section 2) to make the actual per-task decision.
 */
export function recommendRouting(tier: AstraBudgetTier): RoutingGuidance {
  switch (tier) {
    case 'NORMAL':
      return {
        tier,
        astraMayDoArchitecture: true,
        astraMayDoRoutineImplementation: true,
        delegateRoutineWorkAway: false,
        protectFinalIntegrationReserve: true,
        note: '>70% remaining: architecture and difficult implementation are both fine.',
      };
    case 'CONSERVE':
      return {
        tier,
        astraMayDoArchitecture: true,
        astraMayDoRoutineImplementation: true,
        delegateRoutineWorkAway: true,
        protectFinalIntegrationReserve: true,
        note: '50-70% remaining: increase delegation of routine implementation to Claude/Agy.',
      };
    case 'RESERVE':
      return {
        tier,
        astraMayDoArchitecture: true,
        astraMayDoRoutineImplementation: false,
        delegateRoutineWorkAway: true,
        protectFinalIntegrationReserve: true,
        note: '30-50% remaining: Astra takes high-value implementation and decisions only.',
      };
    case 'CRITICAL':
      return {
        tier,
        astraMayDoArchitecture: false,
        astraMayDoRoutineImplementation: false,
        delegateRoutineWorkAway: true,
        protectFinalIntegrationReserve: true,
        note: '<30% remaining: Astra is architect/reviewer/integrator/difficult-bug-solver only. Everything routine goes elsewhere.',
      };
  }
}

/**
 * Records a self-report of remaining allowance. This is the ONLY way
 * allowanceRemainingPct/tier change — never inferred from adapter output,
 * per the honesty rule in boardroom/BOARDROOM.md.
 */
export function selfReportAllowance(pct: number, reportedBy: 'DUSTIN' | AgentName, root?: string): AstraBudgetState {
  const state = getBudgetState(root);
  state.allowanceRemainingPct = pct;
  state.tier = classifyTier(pct);
  state.lastSelfReportedAt = new Date().toISOString();
  state.lastSelfReportedBy = reportedBy;
  writeJsonAtomic(budgetFile(root), state);
  return state;
}

export interface ResetRequestResult {
  actionRequired: true;
  which: 1 | 2;
  message: string;
}

/**
 * Requesting a reset NEVER increments resetCreditsUsed itself — it only
 * returns an ACTION_REQUIRED result for the caller to surface to Dustin.
 * The counter only ever moves via confirmResetRedeemed, which requires an
 * explicit human confirmation call. This is the literal mechanism that
 * prevents Boardroom from ever fabricating a reset (Section 7/8).
 */
export function requestReset(which: 1 | 2, root?: string): ResetRequestResult {
  const state = getBudgetState(root);
  if (state.resetCreditsUsed >= which) {
    // Already redeemed — still surface as informational, not silently no-op.
  }
  return {
    actionRequired: true,
    which,
    message: `ACTION REQUIRED: ASTRA RESET CREDIT #${which}. Redemption requires a manual account/UI action — Boardroom cannot do this for you. Run \`npm run boardroom:budget confirm-reset-${which}\` only after you've actually redeemed it.`,
  };
}

/** The only function that may increment resetCreditsUsed — always a deliberate, explicit human action. */
export function confirmResetRedeemed(which: 1 | 2, root?: string): AstraBudgetState {
  const state = getBudgetState(root);
  if (which === 2 && state.resetCreditsUsed < 1) {
    throw new Error('Reset #2 cannot be confirmed before Reset #1 has been confirmed.');
  }
  if (state.resetCreditsUsed >= which) {
    return state; // idempotent — already recorded
  }
  state.resetCreditsUsed = which;
  state.resetHistory.push({ which, confirmedAt: new Date().toISOString(), confirmedBy: 'DUSTIN' });
  writeJsonAtomic(budgetFile(root), state);
  return state;
}

export function resetCreditsRemaining(root?: string): number {
  const state = getBudgetState(root);
  return state.resetCreditsTotal - state.resetCreditsUsed;
}
