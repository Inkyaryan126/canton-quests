import { describe, expect, it } from 'vitest';
import { validateGridCityPowerConfig } from '../lib/grid/core/city-power';
import { GRID_STAT_DEFINITIONS } from '../lib/grid/core/progression';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { cantonFoundingSeasonCityPower } from '../lib/grid/cities/canton/founding-season-city-power';

describe('Canton Founding Season live City Power config', () => {
  it('is attached to the city package and passes core validation', () => {
    expect(cantonFoundingSeasonPackage.seasonTemplate.cityPower).toBe(
      cantonFoundingSeasonCityPower,
    );
    expect(() =>
      validateGridCityPowerConfig(cantonFoundingSeasonCityPower),
    ).not.toThrow();
  });

  it('uses only authoritative progression stats and keeps every single axis below 25%', () => {
    const statKeys = new Set(GRID_STAT_DEFINITIONS.map((definition) => definition.key));
    for (const component of cantonFoundingSeasonCityPower.components) {
      expect(statKeys.has(component.id as never)).toBe(true);
      expect(component.weightBps).toBeLessThanOrEqual(2500);
    }
    expect(
      cantonFoundingSeasonCityPower.components.reduce(
        (sum, component) => sum + component.weightBps,
        0,
      ),
    ).toBe(10000);
  });

  it('covers control, economy, strategic strength, competition, objectives, and city mastery', () => {
    expect(
      cantonFoundingSeasonCityPower.components.map((component) => component.id),
    ).toEqual([
      'territoryControl',
      'propertyValue',
      'influence',
      'challengeRating',
      'seasonScore',
      'cityMastery',
    ]);
  });
});
