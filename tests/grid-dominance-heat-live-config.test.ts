import { describe, expect, it } from 'vitest';
import {
  projectGridDominanceHeat,
  validateGridDominanceHeatConfig,
} from '../lib/grid/core/dominance-heat';
import { cantonDominanceHeatConfig } from '../lib/grid/cities/canton/dominance-heat';

describe('Canton live Dominance Heat config', () => {
  it('passes the core contract with warm, hot, and critical thresholds', () => {
    expect(() =>
      validateGridDominanceHeatConfig(cantonDominanceHeatConfig),
    ).not.toThrow();

    expect(
      cantonDominanceHeatConfig.bands.map((band) => [
        band.id,
        band.minDominanceBps,
      ]),
    ).toEqual([
      ['warm', 3_500],
      ['hot', 5_000],
      ['critical', 7_500],
    ]);
  });

  it('keeps every counter-pressure effect monotonic as dominance rises', () => {
    const keys = [
      'neutralFactionPressureBps',
      'borderRewardBonusBps',
      'upkeepSurchargeBps',
      'rivalObjectiveBonusBps',
      'antiMonopolyContractSlots',
    ] as const;

    for (let index = 1; index < cantonDominanceHeatConfig.bands.length; index += 1) {
      const before = cantonDominanceHeatConfig.bands[index - 1].effects;
      const after = cantonDominanceHeatConfig.bands[index].effects;
      for (const key of keys) {
        expect(after[key]).toBeGreaterThanOrEqual(before[key]);
      }
    }
  });

  it('activates the expected Canton bands at exact territory shares', () => {
    const warm = projectGridDominanceHeat(
      {
        actorId: 'p',
        actorKind: 'player',
        controlledTerritories: 7,
        eligibleTerritories: 20,
      },
      cantonDominanceHeatConfig,
    );
    const hot = projectGridDominanceHeat(
      {
        actorId: 'p',
        actorKind: 'player',
        controlledTerritories: 10,
        eligibleTerritories: 20,
      },
      cantonDominanceHeatConfig,
    );
    const critical = projectGridDominanceHeat(
      {
        actorId: 'p',
        actorKind: 'player',
        controlledTerritories: 15,
        eligibleTerritories: 20,
      },
      cantonDominanceHeatConfig,
    );

    expect(warm.bandId).toBe('warm');
    expect(hot.bandId).toBe('hot');
    expect(critical.bandId).toBe('critical');
  });
});
