import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonContest } from '../lib/grid/cities/canton/founding-season-contest';
import { runContestRoundSimulation } from '../lib/grid/sim/contest-sim';

const BASE = {
  seed: 20260916,
  iterations: 12_000,
  attackerCommittedInfluence: 30,
  defenderCommittedInfluence: 40,
};

describe('GRID contest balance simulation', () => {
  it('replays the same Signal Dice sample identically for the same seed', () => {
    const first = runContestRoundSimulation(cantonFoundingSeasonContest, BASE);
    const second = runContestRoundSimulation(cantonFoundingSeasonContest, BASE);

    expect(second).toEqual(first);
    expect(first.attackerDice).toBe(2);
    expect(first.defenderDice).toBe(2);
    expect(first.totalComparisons).toBe(BASE.iterations * 2);
  });

  it('changes the sampled trajectory when the seed changes', () => {
    const first = runContestRoundSimulation(cantonFoundingSeasonContest, BASE);
    const second = runContestRoundSimulation(cantonFoundingSeasonContest, {
      ...BASE,
      seed: BASE.seed + 1,
    });

    expect(second.comparisonWins).not.toEqual(first.comparisonWins);
  });

  it('shows the configured defender tie edge in an equal one-die matchup', () => {
    const report = runContestRoundSimulation(cantonFoundingSeasonContest, {
      ...BASE,
      attackerCommittedInfluence: 10,
      defenderCommittedInfluence: 10,
    });

    expect(report.attackerDice).toBe(1);
    expect(report.defenderDice).toBe(1);
    expect(report.comparisonWinRate.defender).toBeGreaterThan(0.55);
    expect(report.comparisonWinRate.attacker).toBeLessThan(0.45);
  });

  it('shows the extra attacker dice advantage at the top Founding Season band', () => {
    const report = runContestRoundSimulation(cantonFoundingSeasonContest, {
      ...BASE,
      attackerCommittedInfluence: 60,
      defenderCommittedInfluence: 10,
    });

    expect(report.attackerDice).toBe(3);
    expect(report.defenderDice).toBe(1);
    expect(report.comparisonWinRate.attacker).toBeGreaterThan(0.6);
    expect(report.averageInfluenceLost.defender).toBeGreaterThan(
      report.averageInfluenceLost.attacker,
    );
  });

  it('reports a no-comparison baseline below the first configured dice bands', () => {
    const report = runContestRoundSimulation(cantonFoundingSeasonContest, {
      ...BASE,
      attackerCommittedInfluence: 1,
      defenderCommittedInfluence: 1,
    });

    expect(report.totalComparisons).toBe(0);
    expect(report.roundAdvantageRate.even).toBe(1);
    expect(report.averageInfluenceLost).toEqual({ attacker: 0, defender: 0 });
  });

  it('rejects invalid simulation inputs before generating samples', () => {
    expect(() =>
      runContestRoundSimulation(cantonFoundingSeasonContest, {
        ...BASE,
        iterations: 0,
      }),
    ).toThrow('contest simulation iterations must be a positive integer');

    expect(() =>
      runContestRoundSimulation(cantonFoundingSeasonContest, {
        ...BASE,
        attackerCommittedInfluence: 10.5,
      }),
    ).toThrow('attacker committed Influence must be a positive integer');
  });
});
