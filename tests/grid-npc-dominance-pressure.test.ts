import { describe, expect, it } from 'vitest';
import { cantonDominanceHeatConfig } from '../lib/grid/cities/canton/dominance-heat';
import { deriveGridNpcDominancePressure } from '../lib/grid/server/npc-dominance-pressure';

describe('Grid NPC Dominance pressure derivation', () => {
  it('stays at zero when nobody controls territory', () => {
    expect(
      deriveGridNpcDominancePressure(
        {
          eligibleTerritories: 20,
          ownerPlayerIds: [],
          allianceMemberships: [],
        },
        cantonDominanceHeatConfig,
      ),
    ).toEqual({
      pressureBps: 0,
      source: 'none',
      dominanceScoreBps: 0,
      bandId: null,
      controlledTerritories: 0,
    });
  });

  it('turns personal Warm, Hot, and Critical concentration into neutral faction pressure', () => {
    const resultFor = (count: number) =>
      deriveGridNpcDominancePressure(
        {
          eligibleTerritories: 20,
          ownerPlayerIds: Array.from(
            { length: count },
            () => 'player-dominant',
          ),
          allianceMemberships: [],
        },
        cantonDominanceHeatConfig,
      );

    expect(resultFor(7)).toMatchObject({
      source: 'player',
      dominanceScoreBps: 3500,
      bandId: 'warm',
      pressureBps: 500,
    });
    expect(resultFor(10)).toMatchObject({
      source: 'player',
      dominanceScoreBps: 5000,
      bandId: 'hot',
      pressureBps: 1200,
    });
    expect(resultFor(15)).toMatchObject({
      source: 'player',
      dominanceScoreBps: 7500,
      bandId: 'critical',
      pressureBps: 2500,
    });
  });

  it('combines member-owned territory into alliance Heat without double-counting a player', () => {
    const result = deriveGridNpcDominancePressure(
      {
        eligibleTerritories: 20,
        ownerPlayerIds: [
          ...Array.from({ length: 6 }, () => 'player-a'),
          ...Array.from({ length: 5 }, () => 'player-b'),
          ...Array.from({ length: 2 }, () => 'player-c'),
        ],
        allianceMemberships: [
          { allianceId: 'alliance-1', playerId: 'player-a' },
          { allianceId: 'alliance-1', playerId: 'player-b' },
        ],
      },
      cantonDominanceHeatConfig,
    );

    expect(result).toMatchObject({
      source: 'alliance',
      controlledTerritories: 11,
      dominanceScoreBps: 5500,
      bandId: 'hot',
      pressureBps: 1200,
    });
  });

  it('fails closed on impossible ownership or multiple active alliances for one player', () => {
    expect(() =>
      deriveGridNpcDominancePressure(
        {
          eligibleTerritories: 2,
          ownerPlayerIds: ['p', 'p', 'p'],
          allianceMemberships: [],
        },
        cantonDominanceHeatConfig,
      ),
    ).toThrow('ownership exceeds eligible');

    expect(() =>
      deriveGridNpcDominancePressure(
        {
          eligibleTerritories: 20,
          ownerPlayerIds: ['p'],
          allianceMemberships: [
            { allianceId: 'a', playerId: 'p' },
            { allianceId: 'b', playerId: 'p' },
          ],
        },
        cantonDominanceHeatConfig,
      ),
    ).toThrow('multiple active alliances');
  });
});
