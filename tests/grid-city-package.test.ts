import { describe, expect, it } from 'vitest';
import type { GridCityPackage } from '../lib/grid/core/types';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

function basePackage(): GridCityPackage {
  return {
    schemaVersion: 1,
    packageVersion: 1,
    status: 'draft',
    city: {
      slug: 'test-city',
      name: 'Test City',
      regionCode: 'OH',
      countryCode: 'US',
      timezone: 'America/New_York',
      mapCenter: { lat: 40.8, lng: -81.37 },
    },
    seasonTemplate: {
      slug: 'founding-season',
      name: 'Founding Season',
      durationDays: 30,
      surgeHours: 72,
      balance: {
        startingCredits: 5000,
        startingInfluence: 100,
        maxCommandPoints: 10,
        commandPointRegenMinutes: 60,
      },
    },
    districts: [],
    territories: [],
    edges: [],
    properties: [],
    landmarks: [],
  };
}

describe('validateGridCityPackage', () => {
  it('allows an intentionally incomplete draft package', () => {
    expect(validateGridCityPackage(basePackage())).toEqual({ ok: true, errors: [] });
  });

  it('requires playable geography before a package may be ready', () => {
    const pkg = basePackage();
    pkg.status = 'ready';

    const result = validateGridCityPackage(pkg);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('ready package requires at least one district');
    expect(result.errors).toContain('ready package requires at least one territory');
  });

  it('rejects duplicate slugs and broken references', () => {
    const pkg = basePackage();
    pkg.districts = [
      { slug: 'downtown', name: 'Downtown' },
      { slug: 'downtown', name: 'Duplicate Downtown' },
    ];
    pkg.territories = [
      {
        slug: 't-1',
        name: 'T1',
        districtSlug: 'missing-district',
        baseValue: 100,
      },
      {
        slug: 't-1',
        name: 'Duplicate T1',
        districtSlug: 'downtown',
        baseValue: 100,
      },
    ];

    const result = validateGridCityPackage(pkg);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('duplicate district slug: downtown');
    expect(result.errors).toContain('duplicate territory slug: t-1');
    expect(result.errors).toContain('territory t-1 references unknown district missing-district');
  });

  it('rejects self-edges and edges that reference unknown territory', () => {
    const pkg = basePackage();
    pkg.districts = [{ slug: 'd-1', name: 'District' }];
    pkg.territories = [
      { slug: 'a', name: 'A', districtSlug: 'd-1', baseValue: 100 },
    ];
    pkg.edges = [
      { a: 'a', b: 'a' },
      { a: 'a', b: 'missing' },
    ];

    const result = validateGridCityPackage(pkg);

    expect(result.errors).toContain('territory edge cannot connect a to itself');
    expect(result.errors).toContain('territory edge a -> missing references unknown territory');
  });
});
