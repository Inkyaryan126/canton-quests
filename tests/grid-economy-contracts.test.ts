import { describe, expect, it } from 'vitest';
import type { GridCityPackage } from '../lib/grid/core/types';
import type { GridEconomyConfig } from '../lib/grid/core/economy-types';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

function packageWithGeography(): GridCityPackage {
  return {
    schemaVersion: 1,
    packageVersion: 1,
    status: 'draft',
    city: {
      slug: 'test-city',
      name: 'Test City',
      regionCode: 'TS',
      countryCode: 'US',
      timezone: 'America/New_York',
      mapCenter: { lat: 40, lng: -81 },
    },
    seasonTemplate: {
      slug: 'test-season',
      name: 'Test Season',
      durationDays: 30,
      surgeHours: 72,
      balance: {
        startingCredits: 500,
        startingInfluence: 100,
        maxCommandPoints: 10,
        commandPointRegenMinutes: 60,
      },
    },
    districts: [{ slug: 'd1', name: 'District 1' }],
    territories: [
      { slug: 't1', name: 'T1', districtSlug: 'd1', baseValue: 100 },
      { slug: 't2', name: 'T2', districtSlug: 'd1', baseValue: 200 },
    ],
    edges: [{ a: 't1', b: 't2' }],
    properties: [
      { slug: 'p1', name: 'P1', territorySlug: 't1', baseValue: 50, publicNameSafe: true },
    ],
    landmarks: [],
  };
}

function cost(credits = 0, commandPoints = 0) {
  return { credits, commandPoints };
}

function validEconomy(): GridEconomyConfig {
  const level = (branchBonus: Record<string, number> = {}) => ({
    level: 1,
    cost: cost(100, 1),
    bonuses: branchBonus,
  });

  return {
    offlineAccrualCapMinutes: 720,
    neutralClaims: {
      defaultCost: cost(25, 1),
      costByTerritorySlug: { t2: cost(50, 2) },
      starterTerritorySlugs: ['t1'],
    },
    income: {
      territories: {
        defaultRate: { creditsPerHour: 2, influencePerHour: 1 },
        rateBySlug: { t2: { creditsPerHour: 3, influencePerHour: 1 } },
      },
      properties: {
        defaultRate: { creditsPerHour: 5, influencePerHour: 0 },
        rateBySlug: { p1: { creditsPerHour: 6, influencePerHour: 1 } },
      },
    },
    propertyAcquisition: {
      requireTerritoryControl: true,
      defaultCost: cost(100, 1),
      costByPropertySlug: { p1: cost(125, 1) },
    },
    development: {
      commerce: { levels: [level({ creditsPerHour: 2 })] },
      influence: { levels: [level({ influencePerHour: 2 })] },
      fortress: { levels: [level({ defenseBps: 250 })] },
      intel: { levels: [level({ intelBps: 250 })] },
      prestige: { levels: [level({ prestigeBps: 250 })] },
    },
    skyline: {
      rules: [
        {
          id: 'mixed-three',
          minDevelopedProperties: 3,
          branchMode: 'mixed',
          bonuses: { creditsPerHour: 1, prestigeBps: 100 },
        },
      ],
    },
  };
}

describe('Grid economy configuration contract', () => {
  it('keeps legacy city packages valid when economy is not configured', () => {
    expect(validateGridCityPackage(packageWithGeography())).toEqual({ ok: true, errors: [] });
  });

  it('accepts a complete city-agnostic economy configuration with asset overrides', () => {
    const pkg = packageWithGeography();
    pkg.seasonTemplate.economy = validEconomy();

    expect(validateGridCityPackage(pkg)).toEqual({ ok: true, errors: [] });
  });

  it('rejects invalid numeric values instead of silently accepting magic or fractional state', () => {
    const pkg = packageWithGeography();
    const economy = validEconomy();
    economy.offlineAccrualCapMinutes = 0;
    economy.neutralClaims.defaultCost.credits = -1;
    economy.income.territories.defaultRate.influencePerHour = 0.5;
    economy.development.commerce.levels[0].bonuses.defenseBps = -10;
    pkg.seasonTemplate.economy = economy;

    const result = validateGridCityPackage(pkg);

    expect(result.errors).toContain('economy.offlineAccrualCapMinutes must be a positive integer');
    expect(result.errors).toContain('economy.neutralClaims.defaultCost.credits must be a non-negative integer');
    expect(result.errors).toContain('economy.income.territories.defaultRate.influencePerHour must be a non-negative integer');
    expect(result.errors).toContain('economy.development.commerce.levels[0].bonuses.defenseBps must be a non-negative integer');
  });

  it('validates configured territory and property slug references against the package', () => {
    const pkg = packageWithGeography();
    const economy = validEconomy();
    economy.neutralClaims.starterTerritorySlugs = ['t1', 'missing-territory'];
    economy.neutralClaims.costByTerritorySlug = { missing: cost(10, 1) };
    economy.income.properties.rateBySlug = {
      missingProperty: { creditsPerHour: 1, influencePerHour: 0 },
    };
    economy.propertyAcquisition.costByPropertySlug = { missing: cost(10, 0) };
    pkg.seasonTemplate.economy = economy;

    const result = validateGridCityPackage(pkg);

    expect(result.errors).toContain('economy.neutralClaims.starterTerritorySlugs references unknown territory missing-territory');
    expect(result.errors).toContain('economy.neutralClaims.costByTerritorySlug references unknown territory missing');
    expect(result.errors).toContain('economy.income.properties.rateBySlug references unknown property missingProperty');
    expect(result.errors).toContain('economy.propertyAcquisition.costByPropertySlug references unknown property missing');
  });

  it('rejects duplicate starter slugs, non-consecutive development levels, and duplicate Skyline rule ids', () => {
    const pkg = packageWithGeography();
    const economy = validEconomy();
    economy.neutralClaims.starterTerritorySlugs = ['t1', 't1'];
    economy.development.commerce.levels.push({
      level: 3,
      cost: cost(200, 1),
      bonuses: { creditsPerHour: 4 },
    });
    economy.skyline.rules.push({
      ...economy.skyline.rules[0],
      minDevelopedProperties: 4,
    });
    pkg.seasonTemplate.economy = economy;

    const result = validateGridCityPackage(pkg);

    expect(result.errors).toContain('economy.neutralClaims.starterTerritorySlugs contains duplicate slug: t1');
    expect(result.errors).toContain('economy.development.commerce levels must be consecutive starting at 1');
    expect(result.errors).toContain('duplicate economy.skyline rule id: mixed-three');
  });
});
