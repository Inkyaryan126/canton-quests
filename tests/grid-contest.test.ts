import { describe, expect, it } from 'vitest';
import { resolveSignalDiceRound, signalDiceForCommit } from '../lib/grid/core/contest';
import type { GridContestConfig } from '../lib/grid/core/contest-types';

const config: GridContestConfig = {
  dieSides: 6,
  influenceLossPerComparison: 10,
  tiesFavorDefender: true,
  attacker: {
    maxDice: 3,
    bands: [
      { minCommittedInfluence: 10, dice: 1 },
      { minCommittedInfluence: 30, dice: 2 },
      { minCommittedInfluence: 60, dice: 3 },
    ],
  },
  defender: {
    maxDice: 2,
    bands: [
      { minCommittedInfluence: 10, dice: 1 },
      { minCommittedInfluence: 40, dice: 2 },
    ],
  },
};

describe('Signal Dice contest primitives', () => {
  it('derives dice from configured Influence bands', () => {
    expect(signalDiceForCommit(0, config.attacker)).toBe(0);
    expect(signalDiceForCommit(29, config.attacker)).toBe(1);
    expect(signalDiceForCommit(30, config.attacker)).toBe(2);
    expect(signalDiceForCommit(999, config.attacker)).toBe(3);
    expect(signalDiceForCommit(39, config.defender)).toBe(1);
    expect(signalDiceForCommit(40, config.defender)).toBe(2);
  });

  it('compares highest dice first and gives ties to the defender', () => {
    expect(
      resolveSignalDiceRound(
        {
          attackerCommittedInfluence: 60,
          defenderCommittedInfluence: 40,
          attackerRolls: [6, 4, 1],
          defenderRolls: [6, 3],
        },
        config,
      ),
    ).toEqual({
      comparisons: [
        { attackerRoll: 6, defenderRoll: 6, winner: 'defender' },
        { attackerRoll: 4, defenderRoll: 3, winner: 'attacker' },
      ],
      attackerInfluenceLost: 10,
      defenderInfluenceLost: 10,
      attackerRemainingInfluence: 50,
      defenderRemainingInfluence: 30,
    });
  });

  it('rejects impossible roll counts and invalid die results', () => {
    expect(() =>
      resolveSignalDiceRound(
        {
          attackerCommittedInfluence: 10,
          defenderCommittedInfluence: 10,
          attackerRolls: [6, 5],
          defenderRolls: [4],
        },
        config,
      ),
    ).toThrow(/only 1 dice are allowed/);

    expect(() =>
      resolveSignalDiceRound(
        {
          attackerCommittedInfluence: 10,
          defenderCommittedInfluence: 10,
          attackerRolls: [7],
          defenderRolls: [4],
        },
        config,
      ),
    ).toThrow(/outside 1\.\.6/);
  });

  it('never loses more Influence than was committed', () => {
    const harsh = { ...config, influenceLossPerComparison: 50 };
    const result = resolveSignalDiceRound(
      {
        attackerCommittedInfluence: 10,
        defenderCommittedInfluence: 10,
        attackerRolls: [1],
        defenderRolls: [6],
      },
      harsh,
    );
    expect(result.attackerInfluenceLost).toBe(10);
    expect(result.attackerRemainingInfluence).toBe(0);
  });
});
