import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonContest } from '../lib/grid/cities/canton/founding-season-contest';
import { runContestBalanceSimulation } from '../lib/grid/sim/contest-sim';

describe('Grid contest balance simulation', () => {
  it('is deterministic for the same seed and inputs', () => {
    const options = {
      seed: 20260916,
      roundsPerMatchup: 250,
      attackerCommitments: [10, 30, 60],
      defenderCommitments: [10, 40],
    };

    const first = runContestBalanceSimulation(
      cantonFoundingSeasonContest,
      options,
    );
    const second = runContestBalanceSimulation(
      cantonFoundingSeasonContest,
      options,
    );

    expect(second).toEqual(first);
    expect(first.invariantViolations).toEqual([]);
  });

  it('simulates the configured dice bands without exceeding comparison limits', () => {
    const report = runContestBalanceSimulation(
      cantonFoundingSeasonContest,
      {
        seed: 7,
        roundsPerMatchup: 100,
        attackerCommitments: [60],
        defenderCommitments: [40],
      },
    );

    const matchup = report.matchups[0];
    expect(matchup.attackerDice).toBe(3);
    expect(matchup.defenderDice).toBe(2);
    expect(matchup.rounds).toBe(100);
    expect(matchup.comparisons).toBe(200);
    expect(
      matchup.attackerComparisonWins + matchup.defenderComparisonWins,
    ).toBe(matchup.comparisons);
    expect(report.invariantViolations).toEqual([]);
  });

  it('shows the expected defender edge on one-die ties', () => {
    const report = runContestBalanceSimulation(
      cantonFoundingSeasonContest,
      {
        seed: 99,
        roundsPerMatchup: 10000,
        attackerCommitments: [10],
        defenderCommitments: [10],
      },
    );

    const matchup = report.matchups[0];
    const attackerRate =
      matchup.attackerComparisonWins / matchup.comparisons;

    expect(attackerRate).toBeGreaterThan(0.39);
    expect(attackerRate).toBeLessThan(0.44);
    expect(matchup.tiedComparisons).toBeGreaterThan(0);
    expect(report.invariantViolations).toEqual([]);
  });

  it('rejects invalid simulation inputs', () => {
    expect(() =>
      runContestBalanceSimulation(cantonFoundingSeasonContest, {
        seed: 1,
        roundsPerMatchup: 0,
        attackerCommitments: [10],
        defenderCommitments: [10],
      }),
    ).toThrow(/roundsPerMatchup/);

    expect(() =>
      runContestBalanceSimulation(cantonFoundingSeasonContest, {
        seed: 1,
        roundsPerMatchup: 10,
        attackerCommitments: [],
        defenderCommitments: [10],
      }),
    ).toThrow(/attacker commitments cannot be empty/);
  });
});
