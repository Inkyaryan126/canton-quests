import { describe, expect, it } from 'vitest';
import {
  projectGridDominanceHeat,
  validateGridDominanceHeatConfig,
} from '../lib/grid/core/dominance-heat';
import type { GridDominanceHeatConfig } from '../lib/grid/core/dominance-heat-types';

const config: GridDominanceHeatConfig = {
  bands: [
    {
      id: 'warm',
      minDominanceBps: 3_500,
      effects: {
        neutralFactionPressureBps: 500,
        borderRewardBonusBps: 250,
        upkeepSurchargeBps: 200,
        rivalObjectiveBonusBps: 400,
        antiMonopolyContractSlots: 1,
      },
    },
    {
      id: 'hot',
      minDominanceBps: 5_000,
      effects: {
        neutralFactionPressureBps: 1_200,
        borderRewardBonusBps: 700,
        upkeepSurchargeBps: 800,
        rivalObjectiveBonusBps: 1_000,
        antiMonopolyContractSlots: 2,
      },
    },
    {
      id: 'critical',
      minDominanceBps: 7_500,
      effects: {
        neutralFactionPressureBps: 2_500,
        borderRewardBonusBps: 1_500,
        upkeepSurchargeBps: 1_800,
        rivalObjectiveBonusBps: 2_000,
        antiMonopolyContractSlots: 4,
      },
    },
  ],
};

describe('Grid Dominance Heat', () => {
  it('stays inactive below the first configured band and reports distance to it', () => {
    const projection = projectGridDominanceHeat(
      {
        actorId: 'player-1',
        actorKind: 'player',
        controlledTerritories: 1,
        eligibleTerritories: 4,
      },
      config,
    );

    expect(projection.territoryShareBps).toBe(2_500);
    expect(projection.dominanceScoreBps).toBe(2_500);
    expect(projection.active).toBe(false);
    expect(projection.bandId).toBeNull();
    expect(projection.nextBandId).toBe('warm');
    expect(projection.bpsToNextBand).toBe(1_000);
    expect(projection.effects).toEqual({
      neutralFactionPressureBps: 0,
      borderRewardBonusBps: 0,
      upkeepSurchargeBps: 0,
      rivalObjectiveBonusBps: 0,
      antiMonopolyContractSlots: 0,
    });
  });
  it('selects the highest configured band reached by territory share', () => {
    const projection = projectGridDominanceHeat(
      {
        actorId: 'alliance-1',
        actorKind: 'alliance',
        controlledTerritories: 6,
        eligibleTerritories: 10,
      },
      config,
    );

    expect(projection.territoryShareBps).toBe(6_000);
    expect(projection.strategicValueShareBps).toBe(0);
    expect(projection.exposureSource).toBe('territory-share');
    expect(projection.active).toBe(true);
    expect(projection.bandId).toBe('hot');
    expect(projection.effects.neutralFactionPressureBps).toBe(1_200);
    expect(projection.effects.upkeepSurchargeBps).toBe(800);
    expect(projection.nextBandId).toBe('critical');
    expect(projection.bpsToNextBand).toBe(1_500);
  });
  it('allows strategic value concentration to create exposure independently', () => {
    const projection = projectGridDominanceHeat(
      {
        actorId: 'player-value-heavy',
        actorKind: 'player',
        controlledTerritories: 2,
        eligibleTerritories: 10,
        controlledStrategicValue: 600,
        totalStrategicValue: 1_000,
      },
      config,
    );

    expect(projection.territoryShareBps).toBe(2_000);
    expect(projection.strategicValueShareBps).toBe(6_000);
    expect(projection.dominanceScoreBps).toBe(6_000);
    expect(projection.exposureSource).toBe('strategic-value-share');
    expect(projection.bandId).toBe('hot');
  });

  it('marks equal territory and value concentration as both exposure sources', () => {
    const projection = projectGridDominanceHeat(
      {
        actorId: 'player-balanced',
        actorKind: 'player',
        controlledTerritories: 1,
        eligibleTerritories: 3,
        controlledStrategicValue: 1,
        totalStrategicValue: 3,
      },
      config,
    );

    expect(projection.territoryShareBps).toBe(3_333);
    expect(projection.strategicValueShareBps).toBe(3_333);
    expect(projection.exposureSource).toBe('both');
    expect(projection.active).toBe(false);
  });

  it('supports an empty configuration as a deliberately disabled heat system', () => {
    const projection = projectGridDominanceHeat(
      {
        actorId: 'player-off',
        actorKind: 'player',
        controlledTerritories: 9,
        eligibleTerritories: 10,
      },
      { bands: [] },
    );

    expect(projection.dominanceScoreBps).toBe(9_000);
    expect(projection.active).toBe(false);
    expect(projection.bandId).toBeNull();
    expect(projection.nextBandId).toBeNull();
    expect(projection.bpsToNextBand).toBeNull();
  });

  it('rejects malformed band configuration', () => {
    expect(() =>
      validateGridDominanceHeatConfig({
        bands: [config.bands[1], config.bands[0]],
      }),
    ).toThrow(/ordered by increasing threshold/);

    expect(() =>
      validateGridDominanceHeatConfig({
        bands: [
          config.bands[0],
          { ...config.bands[0] },
        ],
      }),
    ).toThrow(/Duplicate Dominance Heat band id/);

    expect(() =>
      validateGridDominanceHeatConfig({
        bands: [
          {
            ...config.bands[0],
            id: 'bad-effects',
            effects: {
              ...config.bands[0].effects,
              upkeepSurchargeBps: -1,
            },
          },
        ],
      }),
    ).toThrow(/upkeepSurchargeBps/);
  });

  it('rejects impossible ownership and incomplete strategic-value input', () => {
    expect(() =>
      projectGridDominanceHeat(
        {
          actorId: 'player-bad',
          actorKind: 'player',
          controlledTerritories: 5,
          eligibleTerritories: 4,
        },
        config,
      ),
    ).toThrow(/controlledTerritories cannot exceed eligibleTerritories/);

    expect(() =>
      projectGridDominanceHeat(
        {
          actorId: 'player-bad-value',
          actorKind: 'player',
          controlledTerritories: 1,
          eligibleTerritories: 4,
          controlledStrategicValue: 100,
        },
        config,
      ),
    ).toThrow(/must be provided together/);

    expect(() =>
      projectGridDominanceHeat(
        {
          actorId: ' ',
          actorKind: 'player',
          controlledTerritories: 0,
          eligibleTerritories: 4,
        },
        config,
      ),
    ).toThrow(/requires actorId/);
  });
});
