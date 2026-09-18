import { describe, expect, it } from 'vitest';
import type { GridContestConfig } from '../lib/grid/core/contest-types';
import type { GridNpcStrongholdProjection } from '../lib/grid/core/npc-stronghold-types';
import {
  resolveGridPveStrongholdRound,
  startGridPveStrongholdContest,
} from '../lib/grid/core/pve-stronghold-contest';

const contestConfig: GridContestConfig = {
  dieSides: 6,
  influenceLossPerComparison: 10,
  tiesFavorDefender: true,
  attacker: {
    maxDice: 3,
    bands: [
      { minCommittedInfluence: 1, dice: 1 },
      { minCommittedInfluence: 30, dice: 2 },
      { minCommittedInfluence: 60, dice: 3 },
    ],
  },
  defender: {
    maxDice: 2,
    bands: [
      { minCommittedInfluence: 1, dice: 1 },
      { minCommittedInfluence: 30, dice: 2 },
    ],
  },
};

function stronghold(overrides: Partial<GridNpcStrongholdProjection> = {}): GridNpcStrongholdProjection {
  return {
    strongholdId: 'guardian-mckinley',
    status: 'active',
    activationReason: 'season',
    contestable: true,
    baseGarrisonInfluence: 40,
    reinforcementInfluence: 20,
    garrisonInfluence: 60,
    objective: {
      kind: 'pve-landmark',
      factionId: 'ash-wardens',
      territorySlug: 'mckinley',
      landmarkSlug: 'mckinley-monument',
    },
    ...overrides,
  };
}

describe('Grid PvE stronghold contest core', () => {
  it('starts from an active stronghold and snapshots the NPC garrison', () => {
    expect(startGridPveStrongholdContest({
      stronghold: stronghold(),
      attackerCommittedInfluence: 70,
    })).toEqual({
      strongholdId: 'guardian-mckinley',
      factionId: 'ash-wardens',
      objective: {
        kind: 'pve-landmark',
        factionId: 'ash-wardens',
        territorySlug: 'mckinley',
        landmarkSlug: 'mckinley-monument',
      },
      status: 'active',
      roundNumber: 1,
      attackerInitialInfluence: 70,
      attackerRemainingInfluence: 70,
      garrisonInitialInfluence: 60,
      garrisonRemainingInfluence: 60,
    });
  });

  it('reuses Signal Dice comparison and tie rules for a PvE round', () => {
    const state = startGridPveStrongholdContest({
      stronghold: stronghold(), attackerCommittedInfluence: 70,
    });
    const result = resolveGridPveStrongholdRound({
      state,
      attackerRolls: [6, 4, 2],
      garrisonRolls: [6, 3],
    }, contestConfig);

    expect(result.comparisons).toEqual([
      { attackerRoll: 6, defenderRoll: 6, winner: 'defender' },
      { attackerRoll: 4, defenderRoll: 3, winner: 'attacker' },
    ]);
    expect(result.attackerInfluenceLost).toBe(10);
    expect(result.garrisonInfluenceLost).toBe(10);
    expect(result.state).toMatchObject({
      status: 'active',
      roundNumber: 2,
      attackerRemainingInfluence: 60,
      garrisonRemainingInfluence: 50,
    });
  });

  it('captures a stronghold only if the attacker survives the finishing round', () => {
    const state = startGridPveStrongholdContest({
      stronghold: stronghold({ garrisonInfluence: 10 }),
      attackerCommittedInfluence: 20,
    });
    const result = resolveGridPveStrongholdRound({
      state,
      attackerRolls: [6],
      garrisonRolls: [1],
    }, contestConfig);

    expect(result.state.status).toBe('captured');
    expect(result.state.attackerRemainingInfluence).toBe(20);
    expect(result.state.garrisonRemainingInfluence).toBe(0);
  });

  it('repels the assault when attacker Influence reaches zero', () => {
    const state = startGridPveStrongholdContest({
      stronghold: stronghold({ garrisonInfluence: 20 }),
      attackerCommittedInfluence: 10,
    });
    const result = resolveGridPveStrongholdRound({
      state,
      attackerRolls: [1],
      garrisonRolls: [6],
    }, contestConfig);

    expect(result.state.status).toBe('repelled');
    expect(result.state.attackerRemainingInfluence).toBe(0);
    expect(result.state.garrisonRemainingInfluence).toBe(20);
  });

  it('gives defender advantage if both sides reach zero in the same round', () => {
    const state = startGridPveStrongholdContest({
      stronghold: stronghold({ garrisonInfluence: 10 }),
      attackerCommittedInfluence: 10,
    });
    const twoComparisons: GridContestConfig = {
      ...contestConfig,
      attacker: { maxDice: 2, bands: [{ minCommittedInfluence: 1, dice: 2 }] },
      defender: { maxDice: 2, bands: [{ minCommittedInfluence: 1, dice: 2 }] },
    };
    const result = resolveGridPveStrongholdRound({
      state,
      attackerRolls: [6, 1],
      garrisonRolls: [5, 2],
    }, twoComparisons);

    expect(result.attackerInfluenceLost).toBe(10);
    expect(result.garrisonInfluenceLost).toBe(10);
    expect(result.state.attackerRemainingInfluence).toBe(0);
    expect(result.state.garrisonRemainingInfluence).toBe(0);
    expect(result.state.status).toBe('repelled');
  });

  it('refuses dormant/captured strongholds and invalid commitments', () => {
    expect(() => startGridPveStrongholdContest({
      stronghold: stronghold({ status: 'dormant', contestable: false, garrisonInfluence: 0 }),
      attackerCommittedInfluence: 40,
    })).toThrow('active and contestable');
    expect(() => startGridPveStrongholdContest({
      stronghold: stronghold(), attackerCommittedInfluence: 0,
    })).toThrow('positive safe integer');
  });

  it('cannot resolve a finished contest twice', () => {
    const state = startGridPveStrongholdContest({
      stronghold: stronghold({ garrisonInfluence: 10 }), attackerCommittedInfluence: 20,
    });
    const captured = resolveGridPveStrongholdRound({
      state, attackerRolls: [6], garrisonRolls: [1],
    }, contestConfig).state;

    expect(() => resolveGridPveStrongholdRound({
      state: captured, attackerRolls: [], garrisonRolls: [],
    }, contestConfig)).toThrow('already resolved');
  });

  it('rejects impossible or malformed persisted state before resolving', () => {
    const state = startGridPveStrongholdContest({
      stronghold: stronghold(), attackerCommittedInfluence: 70,
    });
    expect(() => resolveGridPveStrongholdRound({
      state: { ...state, attackerRemainingInfluence: 71 },
      attackerRolls: [6], garrisonRolls: [1],
    }, contestConfig)).toThrow('cannot exceed initial Influence');
  });

  it('ends a fight when positive remaining Influence falls below the Signal Dice threshold', () => {
    const thresholdConfig: GridContestConfig = {
      ...contestConfig,
      influenceLossPerComparison: 10,
      attacker: { maxDice: 1, bands: [{ minCommittedInfluence: 15, dice: 1 }] },
      defender: { maxDice: 1, bands: [{ minCommittedInfluence: 15, dice: 1 }] },
    };
    const attackerState = startGridPveStrongholdContest({
      stronghold: stronghold({ garrisonInfluence: 20 }), attackerCommittedInfluence: 20,
    });
    const repelled = resolveGridPveStrongholdRound({
      state: attackerState, attackerRolls: [1], garrisonRolls: [6],
    }, thresholdConfig);
    expect(repelled.state.attackerRemainingInfluence).toBe(10);
    expect(repelled.state.status).toBe('repelled');

    const garrisonState = startGridPveStrongholdContest({
      stronghold: stronghold({ garrisonInfluence: 20 }), attackerCommittedInfluence: 20,
    });
    const captured = resolveGridPveStrongholdRound({
      state: garrisonState, attackerRolls: [6], garrisonRolls: [1],
    }, thresholdConfig);
    expect(captured.state.garrisonRemainingInfluence).toBe(10);
    expect(captured.state.status).toBe('captured');
  });

});
