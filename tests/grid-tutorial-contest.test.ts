import { describe, expect, it } from 'vitest';
import type { GridContestConfig } from '../lib/grid/core/contest-types';
import {
  applyGridTutorialContestAction,
  createGridTutorialContest,
  gridTutorialContestComplete,
} from '../lib/grid/core/tutorial-contest';

const contestConfig: GridContestConfig = {
  dieSides: 6,
  influenceLossPerComparison: 10,
  tiesFavorDefender: true,
  attacker: {
    maxDice: 2,
    bands: [
      { minCommittedInfluence: 10, dice: 1 },
      { minCommittedInfluence: 30, dice: 2 },
    ],
  },
  defender: {
    maxDice: 2,
    bands: [
      { minCommittedInfluence: 10, dice: 1 },
      { minCommittedInfluence: 30, dice: 2 },
    ],
  },
};

const tutorialConfig = {
  attackerInitialCommitInfluence: 20,
  attackerReserveInfluence: 20,
  reinforcementInfluence: 10,
  defenderCommittedInfluence: 30,
};

describe('Grid safe tutorial contest', () => {
  it('starts in an isolated sandbox with zero live resource delta', () => {
    const state = createGridTutorialContest(tutorialConfig);

    expect(state.phase).toBe('reinforce');
    expect(state.safeMode).toBe(true);
    expect(state.liveResourceDelta).toBe(0);
    expect(state.lessons).toEqual({
      reinforce: false,
      contest: false,
      continue: false,
      withdraw: false,
    });
    expect(gridTutorialContestComplete(state)).toBe(false);
  });

  it('teaches reinforce → contest → continue → withdraw in order', () => {
    const initial = createGridTutorialContest(tutorialConfig);
    const reinforced = applyGridTutorialContestAction(
      initial,
      { type: 'reinforce' },
      tutorialConfig,
      contestConfig,
    );

    expect(reinforced.phase).toBe('contest');
    expect(reinforced.attackerCommittedInfluence).toBe(30);
    expect(reinforced.attackerReserveInfluence).toBe(10);
    expect(reinforced.lessons.reinforce).toBe(true);

    const contested = applyGridTutorialContestAction(
      reinforced,
      {
        type: 'contest',
        attackerRolls: [6, 4],
        defenderRolls: [5, 4],
      },
      tutorialConfig,
      contestConfig,
    );

    expect(contested.phase).toBe('continue');
    expect(contested.rounds).toHaveLength(1);
    expect(contested.attackerCommittedInfluence).toBe(20);
    expect(contested.defenderCommittedInfluence).toBe(20);
    expect(contested.rounds[0].result.comparisons.map((item) => item.winner))
      .toEqual(['attacker', 'defender']);

    const continued = applyGridTutorialContestAction(
      contested,
      {
        type: 'continue',
        attackerRolls: [5],
        defenderRolls: [2],
      },
      tutorialConfig,
      contestConfig,
    );

    expect(continued.phase).toBe('withdraw');
    expect(continued.rounds).toHaveLength(2);
    expect(continued.lessons.continue).toBe(true);

    const complete = applyGridTutorialContestAction(
      continued,
      { type: 'withdraw' },
      tutorialConfig,
      contestConfig,
    );

    expect(complete.phase).toBe('complete');
    expect(complete.lessons).toEqual({
      reinforce: true,
      contest: true,
      continue: true,
      withdraw: true,
    });
    expect(complete.liveResourceDelta).toBe(0);
    expect(gridTutorialContestComplete(complete)).toBe(true);
  });

  it('never mutates the prior tutorial state', () => {
    const initial = createGridTutorialContest(tutorialConfig);
    const reinforced = applyGridTutorialContestAction(
      initial,
      { type: 'reinforce' },
      tutorialConfig,
      contestConfig,
    );

    expect(initial.phase).toBe('reinforce');
    expect(initial.attackerCommittedInfluence).toBe(20);
    expect(initial.attackerReserveInfluence).toBe(20);
    expect(reinforced).not.toBe(initial);
  });

  it('rejects skipping tutorial lessons or acting after completion', () => {
    const initial = createGridTutorialContest(tutorialConfig);

    expect(() =>
      applyGridTutorialContestAction(
        initial,
        { type: 'contest', attackerRolls: [6], defenderRolls: [1] },
        tutorialConfig,
        contestConfig,
      ),
    ).toThrow(/cannot contest during reinforce phase/);

    expect(() =>
      applyGridTutorialContestAction(
        initial,
        { type: 'withdraw' },
        tutorialConfig,
        contestConfig,
      ),
    ).toThrow(/cannot withdraw during reinforce phase/);
  });

  it('rejects unsafe tutorial configuration and invalid dice', () => {
    expect(() =>
      createGridTutorialContest({
        ...tutorialConfig,
        reinforcementInfluence: 30,
      }),
    ).toThrow(/cannot exceed attackerReserveInfluence/);

    const reinforced = applyGridTutorialContestAction(
      createGridTutorialContest(tutorialConfig),
      { type: 'reinforce' },
      tutorialConfig,
      contestConfig,
    );

    expect(() =>
      applyGridTutorialContestAction(
        reinforced,
        { type: 'contest', attackerRolls: [7], defenderRolls: [1] },
        tutorialConfig,
        contestConfig,
      ),
    ).toThrow(/outside 1\.\.6/);
  });
});
