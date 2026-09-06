// Canton Quests Boardroom V2 — Astra budget tests.
//
// Astra's allowance is self-reported only, never auto-detected, and reset
// credits only ever move via an explicit human-confirmed call — these
// tests assert that mechanism directly (see boardroom/BOARDROOM.md).

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBudgetState, classifyTier, recommendRouting, selfReportAllowance, requestReset, confirmResetRedeemed, resetCreditsRemaining } from '../lib/boardroom/budget';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boardroom-budget-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('classifyTier', () => {
  it.each([
    [100, 'NORMAL'],
    [71, 'NORMAL'],
    [70, 'CONSERVE'],
    [50, 'CONSERVE'],
    [49, 'RESERVE'],
    [30, 'RESERVE'],
    [29, 'CRITICAL'],
    [0, 'CRITICAL'],
  ])('classifies %i%% as %s', (pct, tier) => {
    expect(classifyTier(pct)).toBe(tier);
  });
});

describe('recommendRouting', () => {
  it('NORMAL allows both architecture and routine implementation', () => {
    const g = recommendRouting('NORMAL');
    expect(g.astraMayDoArchitecture).toBe(true);
    expect(g.astraMayDoRoutineImplementation).toBe(true);
    expect(g.delegateRoutineWorkAway).toBe(false);
  });

  it('CRITICAL restricts Astra to architect/reviewer/integrator/difficult-bug roles', () => {
    const g = recommendRouting('CRITICAL');
    expect(g.astraMayDoArchitecture).toBe(false);
    expect(g.astraMayDoRoutineImplementation).toBe(false);
    expect(g.delegateRoutineWorkAway).toBe(true);
  });
});

describe('getBudgetState defaults', () => {
  it('defaults to null allowance / NORMAL tier / zero resets used when no file exists', () => {
    const state = getBudgetState(root);
    expect(state.allowanceRemainingPct).toBeNull();
    expect(state.tier).toBe('NORMAL');
    expect(state.resetCreditsUsed).toBe(0);
    expect(resetCreditsRemaining(root)).toBe(2);
  });
});

describe('selfReportAllowance', () => {
  it('is the only thing that changes allowanceRemainingPct/tier', () => {
    const state = selfReportAllowance(42, 'DUSTIN', root);
    expect(state.allowanceRemainingPct).toBe(42);
    expect(state.tier).toBe('RESERVE');
    expect(state.lastSelfReportedBy).toBe('DUSTIN');
    expect(getBudgetState(root).allowanceRemainingPct).toBe(42);
  });

  it('can be self-reported by an agent, not just Dustin', () => {
    const state = selfReportAllowance(80, 'ASTRA', root);
    expect(state.lastSelfReportedBy).toBe('ASTRA');
  });
});

describe('requestReset / confirmResetRedeemed', () => {
  it('requestReset never increments the counter by itself', () => {
    const result = requestReset(1, root);
    expect(result.actionRequired).toBe(true);
    expect(result.which).toBe(1);
    expect(getBudgetState(root).resetCreditsUsed).toBe(0);
  });

  it('confirmResetRedeemed(1) increments the counter and records history', () => {
    const state = confirmResetRedeemed(1, root);
    expect(state.resetCreditsUsed).toBe(1);
    expect(state.resetHistory).toHaveLength(1);
    expect(state.resetHistory[0].which).toBe(1);
    expect(state.resetHistory[0].confirmedBy).toBe('DUSTIN');
  });

  it('confirmResetRedeemed(2) is refused before Reset #1 has been confirmed', () => {
    expect(() => confirmResetRedeemed(2, root)).toThrow(/Reset #2 cannot be confirmed before Reset #1/);
    expect(getBudgetState(root).resetCreditsUsed).toBe(0);
  });

  it('confirmResetRedeemed(2) succeeds after Reset #1 is confirmed', () => {
    confirmResetRedeemed(1, root);
    const state = confirmResetRedeemed(2, root);
    expect(state.resetCreditsUsed).toBe(2);
    expect(resetCreditsRemaining(root)).toBe(0);
  });

  it('confirming the same reset twice is idempotent, not double-counted', () => {
    confirmResetRedeemed(1, root);
    const state = confirmResetRedeemed(1, root);
    expect(state.resetCreditsUsed).toBe(1);
    expect(state.resetHistory).toHaveLength(1);
  });
});
