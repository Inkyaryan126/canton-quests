import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { compileCityPackage } from '../lib/grid/compiler/pipeline';
import { createSupabaseGridCityImporter } from '../lib/grid/compiler/supabase-city-importer';
import type { GridRawGeography } from '../lib/grid/compiler/types';
import type { GridCityPackage } from '../lib/grid/core/types';
import { supabaseAdmin } from '../lib/supabase';
import { assertSafeTestSupabaseMutationTarget } from '../lib/supabase-test-safety';
import tinyCityRawJson from './fixtures/grid-compiler/tiny-city-raw.json';

const localUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const runDbTests = Boolean(localUrl && process.env.SUPABASE_SERVICE_ROLE_KEY);

const tinyRaw = tinyCityRawJson as GridRawGeography;
const cityMeta: GridCityPackage['city'] = {
  slug: 'tiny-metro',
  name: 'Tiny Metro',
  regionCode: 'TM',
  countryCode: 'US',
  timezone: 'America/New_York',
  mapCenter: { lat: 1, lng: 1 },
};
const seasonTemplate: GridCityPackage['seasonTemplate'] = {
  slug: 'founding-season',
  name: 'Founding Season',
  durationDays: 30,
  surgeHours: 4,
  balance: {
    startingCredits: 500,
    startingInfluence: 100,
    maxCommandPoints: 10,
    commandPointRegenMinutes: 60,
  },
};

const compiled = compileCityPackage(tinyRaw, seasonTemplate, cityMeta, {
  compilerVersion: '1.0.0',
  sourceSnapshotVersion: 'tiny-import-v1',
  generatedAt: '2026-09-13T12:00:00.000Z',
});
const readyPackage: GridCityPackage = { ...compiled.package, status: 'ready' };

describe('GRID city importer safety', () => {
  it('rejects a remote Supabase client before any database action', () => {
    const remote = createClient('https://example.supabase.co', 'test-key-for-construction-only');
    expect(() => createSupabaseGridCityImporter(remote)).toThrow(/remote supabase targets are denied/i);
  });
});

describe.skipIf(!runDbTests)('GRID local Supabase city importer', () => {
  beforeEach(async () => {
    assertSafeTestSupabaseMutationTarget(localUrl);
    if (!supabaseAdmin) throw new Error('Local Supabase admin client is not configured');
    const { error } = await supabaseAdmin
      .from('grid_cities')
      .delete()
      .in('slug', ['tiny-metro', 'tiny-invalid']);
    if (error) throw error;
  });

  it('imports the fixture package in FK-safe order and is idempotent', async () => {
    if (!supabaseAdmin) throw new Error('Local Supabase admin client is not configured');
    const importer = createSupabaseGridCityImporter(supabaseAdmin);

    const first = await importer.importCityPackage(readyPackage);
    const second = await importer.importCityPackage(readyPackage);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      citySlug: 'tiny-metro',
      districtsUpserted: readyPackage.districts.length,
      territoriesUpserted: readyPackage.territories.length,
      edgesUpserted: readyPackage.edges.length,
      propertiesUpserted: readyPackage.properties.length,
      landmarksUpserted: readyPackage.landmarks.length,
    });

    const { data: city, error: cityError } = await supabaseAdmin
      .from('grid_cities')
      .select('id')
      .eq('slug', 'tiny-metro')
      .single();
    if (cityError) throw cityError;

    for (const [table, expected] of [
      ['grid_districts', readyPackage.districts.length],
      ['grid_territories', readyPackage.territories.length],
      ['grid_territory_edges', readyPackage.edges.length],
      ['grid_properties', readyPackage.properties.length],
      ['grid_landmarks', readyPackage.landmarks.length],
    ] as const) {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('city_id', city.id);
      if (error) throw error;
      expect(count, table).toBe(expected);
    }
  });

  it('rejects an invalid ready package before writing its city row', async () => {
    if (!supabaseAdmin) throw new Error('Local Supabase admin client is not configured');
    const importer = createSupabaseGridCityImporter(supabaseAdmin);
    const invalid: GridCityPackage = {
      ...readyPackage,
      city: { ...readyPackage.city, slug: 'tiny-invalid', name: 'Tiny Invalid' },
      territories: [],
      edges: [],
    };

    await expect(importer.importCityPackage(invalid)).rejects.toThrow(/validation errors/i);

    const { data, error } = await supabaseAdmin
      .from('grid_cities')
      .select('id')
      .eq('slug', 'tiny-invalid');
    if (error) throw error;
    expect(data).toHaveLength(0);
  });
});
