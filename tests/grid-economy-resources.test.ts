import { describe, expect, it } from 'vitest';
import type { GridEconomyConfig } from '../lib/grid/core/economy-types';
import {
  resolvePropertyAcquisitionCost,
  resolvePropertyIncomeRate,
  resolveTerritoryClaimCost,
  resolveTerritoryIncomeRate,
  settleCommandPoints,
  settleGridResources,
} from '../lib/grid/core/resources';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

function economy(): GridEconomyConfig {
  const branch = {
    levels: [{ level: 1, cost: { credits: 10, commandPoints: 1 }, bonuses: {} }],
  };
  return {
    offlineAccrualCapMinutes: 120,
    neutralClaims: {
      defaultCost: { credits: 25, commandPoints: 1 },
      costByTerritorySlug: { special: { credits: 99, commandPoints: 2 } },
      starterTerritorySlugs: ['starter'],
    },
    income: {
      territories: {
        defaultRate: { creditsPerHour: 2, influencePerHour: 1 },
        rateBySlug: { special: { creditsPerHour: 7, influencePerHour: 3 } },
      },
      properties: {
        defaultRate: { creditsPerHour: 5, influencePerHour: 0 },
        rateBySlug: { landmark: { creditsPerHour: 11, influencePerHour: 2 } },
      },
    },
    propertyAcquisition: {
      requireTerritoryControl: true,
      defaultCost: { credits: 100, commandPoints: 1 },
      costByPropertySlug: { landmark: { credits: 450, commandPoints: 2 } },
    },
    development: {
      commerce: branch,
      influence: branch,
      fortress: branch,
      intel: branch,
      prestige: branch,
    },
    skyline: { rules: [] },
  };
}

describe('settleCommandPoints', () => {
  it('preserves partial regen intervals while the player is below cap', () => {
    const first = settleCommandPoints({
      current: 2,
      max: 10,
      regenIntervalMinutes: 60,
      updatedAtMs: 0,
      nowMs: 150 * MINUTE,
    });

    expect(first).toEqual({
      commandPoints: 4,
      regenerated: 2,
      updatedAtMs: 120 * MINUTE,
    });

    const second = settleCommandPoints({
      current: first.commandPoints,
      max: 10,
      regenIntervalMinutes: 60,
      updatedAtMs: first.updatedAtMs,
      nowMs: 180 * MINUTE,
    });
    expect(second.commandPoints).toBe(5);
    expect(second.regenerated).toBe(1);
    expect(second.updatedAtMs).toBe(180 * MINUTE);
  });

  it('discards hidden overflow time once the player reaches cap', () => {
    const capped = settleCommandPoints({
      current: 9,
      max: 10,
      regenIntervalMinutes: 60,
      updatedAtMs: 0,
      nowMs: 180 * MINUTE,
    });

    expect(capped).toEqual({
      commandPoints: 10,
      regenerated: 1,
      updatedAtMs: 180 * MINUTE,
    });

    const afterSpend = settleCommandPoints({
      current: 9,
      max: 10,
      regenIntervalMinutes: 60,
      updatedAtMs: capped.updatedAtMs,
      nowMs: 210 * MINUTE,
    });
    expect(afterSpend.commandPoints).toBe(9);
    expect(afterSpend.regenerated).toBe(0);
  });
});

describe('settleGridResources', () => {
  it('carries fractional integer remainders so frequent settlement does not lose income', () => {
    const first = settleGridResources({
      credits: 0,
      influence: 0,
      creditsPerHour: 1,
      influencePerHour: 1,
      remainders: { credits: 0, influence: 0 },
      lastSettledAtMs: 0,
      nowMs: 30 * MINUTE,
      offlineAccrualCapMinutes: 120,
    });

    expect(first.creditsEarned).toBe(0);
    expect(first.influenceEarned).toBe(0);
    expect(first.remainders).toEqual({ credits: HOUR / 2, influence: HOUR / 2 });

    const second = settleGridResources({
      credits: first.credits,
      influence: first.influence,
      creditsPerHour: 1,
      influencePerHour: 1,
      remainders: first.remainders,
      lastSettledAtMs: first.settledAtMs,
      nowMs: 60 * MINUTE,
      offlineAccrualCapMinutes: 120,
    });

    const once = settleGridResources({
      credits: 0,
      influence: 0,
      creditsPerHour: 1,
      influencePerHour: 1,
      remainders: { credits: 0, influence: 0 },
      lastSettledAtMs: 0,
      nowMs: HOUR,
      offlineAccrualCapMinutes: 120,
    });

    expect(second.credits).toBe(1);
    expect(second.influence).toBe(1);
    expect(second.remainders).toEqual({ credits: 0, influence: 0 });
    expect(second.credits).toBe(once.credits);
    expect(second.influence).toBe(once.influence);
  });

  it('caps only the billable offline window while advancing settlement to now', () => {
    const result = settleGridResources({
      credits: 10,
      influence: 5,
      creditsPerHour: 10,
      influencePerHour: 4,
      remainders: { credits: 0, influence: 0 },
      lastSettledAtMs: 0,
      nowMs: 5 * HOUR,
      offlineAccrualCapMinutes: 120,
    });

    expect(result.billableMs).toBe(2 * HOUR);
    expect(result.creditsEarned).toBe(20);
    expect(result.influenceEarned).toBe(8);
    expect(result.credits).toBe(30);
    expect(result.influence).toBe(13);
    expect(result.settledAtMs).toBe(5 * HOUR);
  });
});

describe('economy config resolution', () => {
  it('uses explicit overrides and otherwise falls back to configured defaults', () => {
    const config = economy();

    expect(resolveTerritoryClaimCost(config, 'normal')).toEqual({ credits: 25, commandPoints: 1 });
    expect(resolveTerritoryClaimCost(config, 'special')).toEqual({ credits: 99, commandPoints: 2 });
    expect(resolveTerritoryIncomeRate(config, 'normal')).toEqual({ creditsPerHour: 2, influencePerHour: 1 });
    expect(resolveTerritoryIncomeRate(config, 'special')).toEqual({ creditsPerHour: 7, influencePerHour: 3 });
    expect(resolvePropertyAcquisitionCost(config, 'normal')).toEqual({ credits: 100, commandPoints: 1 });
    expect(resolvePropertyAcquisitionCost(config, 'landmark')).toEqual({ credits: 450, commandPoints: 2 });
    expect(resolvePropertyIncomeRate(config, 'landmark')).toEqual({ creditsPerHour: 11, influencePerHour: 2 });
  });
});
