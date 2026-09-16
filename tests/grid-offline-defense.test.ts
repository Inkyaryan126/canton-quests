import { describe, expect, it } from 'vitest';
import {
  decideOfflineDefense,
  rankOfflineDefenseTargets,
  validateOfflineDefensePolicy,
} from '../lib/grid/core/offline-defense';
import type { GridOfflineDefensePolicy } from '../lib/grid/core/offline-defense-types';

const basePolicy: GridOfflineDefensePolicy = {
  doctrineId: 'balanced-v1',
  reserveInfluence: 80,
  maxCommitPerContest: 60,
  defaultCommitBps: 7500,
  autoRetreatBelowInfluence: 10,
  autoRetreatAfterLosses: 50,
  defaultTactic: 'fortify',
  priorityRules: [
    {
      territorySlug: 'territory-alpha',
      priority: 100,
      commitBps: 10000,
      tactic: 'pressure',
    },
    {
      territorySlug: 'territory-beta',
      priority: 50,
    },
  ],
};

describe('Grid offline defense policy core', () => {
  it('allocates a deterministic capped reserve commitment', () => {
    const decision = decideOfflineDefense(basePolicy, {
      targetTerritorySlug: 'territory-gamma',
      reserveInfluenceAvailable: 100,
      currentDefenderInfluence: 80,
      cumulativeInfluenceLost: 0,
      minimumViableCommit: 10,
    });

    expect(decision).toEqual({
      action: 'defend',
      committedInfluence: 45,
      tactic: 'fortify',
      priority: 0,
      reason: 'defend',
    });
  });

  it('applies a territory priority override without mutating policy state', () => {
    const before = JSON.stringify(basePolicy);
    const decision = decideOfflineDefense(basePolicy, {
      targetTerritorySlug: 'territory-alpha',
      reserveInfluenceAvailable: 55,
      currentDefenderInfluence: 70,
      cumulativeInfluenceLost: 0,
      minimumViableCommit: 10,
    });

    expect(decision.action).toBe('defend');
    expect(decision.committedInfluence).toBe(55);
    expect(decision.tactic).toBe('pressure');
    expect(decision.priority).toBe(100);
    expect(JSON.stringify(basePolicy)).toBe(before);
  });

  it('withdraws when the defender reaches the configured strength floor', () => {
    const decision = decideOfflineDefense(basePolicy, {
      targetTerritorySlug: 'territory-alpha',
      reserveInfluenceAvailable: 80,
      currentDefenderInfluence: 10,
      cumulativeInfluenceLost: 20,
      minimumViableCommit: 10,
    });

    expect(decision.action).toBe('withdraw');
    expect(decision.reason).toBe('retreat-threshold');
    expect(decision.committedInfluence).toBe(0);
  });

  it('withdraws after the configured cumulative loss threshold', () => {
    const decision = decideOfflineDefense(basePolicy, {
      targetTerritorySlug: 'territory-beta',
      reserveInfluenceAvailable: 80,
      currentDefenderInfluence: 40,
      cumulativeInfluenceLost: 50,
      minimumViableCommit: 10,
    });

    expect(decision.action).toBe('withdraw');
    expect(decision.reason).toBe('loss-threshold');
  });

  it('withdraws rather than creating a non-viable Signal Dice defense', () => {
    const decision = decideOfflineDefense(
      { ...basePolicy, reserveInfluence: 12, defaultCommitBps: 5000 },
      {
        targetTerritorySlug: 'territory-gamma',
        reserveInfluenceAvailable: 12,
        currentDefenderInfluence: 40,
        cumulativeInfluenceLost: 0,
        minimumViableCommit: 10,
      },
    );

    expect(decision).toMatchObject({
      action: 'withdraw',
      committedInfluence: 0,
      reason: 'insufficient-reserve',
    });
  });

  it('ranks configured defense priorities deterministically', () => {
    expect(
      rankOfflineDefenseTargets(
        ['territory-gamma', 'territory-beta', 'territory-alpha', 'territory-delta'],
        basePolicy,
      ),
    ).toEqual([
      'territory-alpha',
      'territory-beta',
      'territory-delta',
      'territory-gamma',
    ]);
  });

  it('rejects duplicate priority rules and invalid basis points', () => {
    expect(() =>
      validateOfflineDefensePolicy({
        ...basePolicy,
        defaultCommitBps: 10001,
      }),
    ).toThrow(/defaultCommitBps/);

    expect(() =>
      validateOfflineDefensePolicy({
        ...basePolicy,
        priorityRules: [
          ...basePolicy.priorityRules,
          { territorySlug: 'territory-alpha', priority: 1 },
        ],
      }),
    ).toThrow(/duplicate priority rule/);
  });
});
