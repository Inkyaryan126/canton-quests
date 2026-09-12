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

  it('accepts a ready package with minimal playable geography and valid balance', () => {
    const pkg = basePackage();
    pkg.status = 'ready';
    pkg.districts = [{ slug: 'd-1', name: 'District 1' }];
    pkg.territories = [
      { slug: 't-1', name: 'Territory 1', districtSlug: 'd-1', baseValue: 100 },
    ];

    const result = validateGridCityPackage(pkg);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
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

  it('rejects duplicate property and landmark slugs as well as broken territory references', () => {
    const pkg = basePackage();
    pkg.districts = [{ slug: 'd-1', name: 'District 1' }];
    pkg.territories = [
      { slug: 't-1', name: 'Territory 1', districtSlug: 'd-1', baseValue: 100 },
    ];
    pkg.properties = [
      {
        slug: 'prop-1',
        name: 'Property 1',
        territorySlug: 'missing-territory',
        baseValue: 50,
        publicNameSafe: true,
      },
      {
        slug: 'prop-1',
        name: 'Duplicate Property 1',
        territorySlug: 't-1',
        baseValue: 50,
        publicNameSafe: true,
      },
    ];
    pkg.landmarks = [
      {
        slug: 'lm-1',
        name: 'Landmark 1',
        territorySlug: 'missing-territory-2',
        point: { lat: 40.8, lng: -81.37 },
      },
      {
        slug: 'lm-1',
        name: 'Duplicate Landmark 1',
        territorySlug: 't-1',
        point: { lat: 40.8, lng: -81.37 },
      },
    ];

    const result = validateGridCityPackage(pkg);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('duplicate property slug: prop-1');
    expect(result.errors).toContain('duplicate landmark slug: lm-1');
    expect(result.errors).toContain('property prop-1 references unknown territory missing-territory');
    expect(result.errors).toContain('landmark lm-1 references unknown territory missing-territory-2');
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

  it('rejects duplicate edges regardless of direction', () => {
    const pkg = basePackage();
    pkg.districts = [{ slug: 'd-1', name: 'District' }];
    pkg.territories = [
      { slug: 'a', name: 'A', districtSlug: 'd-1', baseValue: 100 },
      { slug: 'b', name: 'B', districtSlug: 'd-1', baseValue: 100 },
    ];
    pkg.edges = [
      { a: 'a', b: 'b' },
      { a: 'b', b: 'a' },
    ];

    const result = validateGridCityPackage(pkg);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('duplicate territory edge: a::b');
  });

  it('validates territory baseValue', () => {
    const pkg = basePackage();
    pkg.districts = [{ slug: 'd-1', name: 'District' }];
    pkg.territories = [
      { slug: 't-1', name: 'T1', districtSlug: 'd-1', baseValue: -10 },
      { slug: 't-2', name: 'T2', districtSlug: 'd-1', baseValue: Number.NaN },
    ];

    const result = validateGridCityPackage(pkg);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('territory t-1 has invalid baseValue');
    expect(result.errors).toContain('territory t-2 has invalid baseValue');
  });

  it('validates seasonTemplate balance and surge duration constraints', () => {
    const pkg = basePackage();
    pkg.seasonTemplate.balance = {
      startingCredits: -1,
      startingInfluence: -10,
      maxCommandPoints: 0,
      commandPointRegenMinutes: 0,
    };
    pkg.seasonTemplate.surgeHours = 720; // 30 days * 24 hours = 720, cannot be >= durationDays * 24

    const result = validateGridCityPackage(pkg);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('startingCredits must be >= 0');
    expect(result.errors).toContain('startingInfluence must be >= 0');
    expect(result.errors).toContain('maxCommandPoints must be > 0');
    expect(result.errors).toContain('commandPointRegenMinutes must be > 0');
    expect(result.errors).toContain('surgeHours must fit inside the season duration');
  });

  it('rejects surgeHours <= 0', () => {
    const pkg = basePackage();
    pkg.seasonTemplate.surgeHours = 0;

    const result = validateGridCityPackage(pkg);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('surgeHours must fit inside the season duration');
  });

  it('ensures lib/grid/core contains zero Canton-specific data or names', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const coreDir = path.resolve(__dirname, '../lib/grid/core');
    const files = fs.readdirSync(coreDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(path.join(coreDir, file), 'utf-8');
      expect(content.toLowerCase()).not.toContain('canton');
      expect(content.toLowerCase()).not.toContain('40.7989');
      expect(content.toLowerCase()).not.toContain('-81.3748');
      expect(content.toLowerCase()).not.toContain('cipher');
    }
  });
});

