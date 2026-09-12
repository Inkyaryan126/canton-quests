import { describe, expect, it } from 'vitest';
import type { GridCityPackage } from '../lib/grid/core/types';
import type { GridProvenanceRecord } from '../lib/grid/compiler/types';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

function baseCityMeta(): GridCityPackage['city'] {
  return {
    slug: 'test-city',
    name: 'Test City',
    regionCode: 'OH',
    countryCode: 'US',
    timezone: 'America/New_York',
    mapCenter: { lat: 40.8, lng: -81.37 },
  };
}

function baseSeasonTemplate(): GridCityPackage['seasonTemplate'] {
  return {
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
  };
}

function minimalLegacyPackage(): GridCityPackage {
  return {
    schemaVersion: 1,
    packageVersion: 1,
    status: 'draft',
    city: baseCityMeta(),
    seasonTemplate: baseSeasonTemplate(),
    districts: [],
    territories: [],
    edges: [],
    properties: [],
    landmarks: [],
  };
}

function fullyPopulatedPackage(): GridCityPackage {
  const provenance: GridProvenanceRecord[] = [
    {
      id: 'osm-overpass-test',
      sourceName: 'OpenStreetMap (via Overpass API)',
      sourceUrl: 'https://overpass-api.de/api/interpreter',
      license: 'ODbL 1.0',
      retrievedAt: '2026-09-12',
      transformation: 'Test fixture transformation description.',
      attribution: '© OpenStreetMap contributors',
      confidence: 'confirmed',
    },
  ];

  return {
    schemaVersion: 1,
    packageVersion: 1,
    status: 'draft',
    city: baseCityMeta(),
    seasonTemplate: baseSeasonTemplate(),
    districts: [
      {
        slug: 'downtown',
        name: 'Downtown',
        sourceRefs: ['osm-overpass-test'],
      },
    ],
    territories: [
      {
        slug: 't-1',
        name: 'T1',
        districtSlug: 'downtown',
        baseValue: 100,
        historical: {
          era: 'industrial',
          activationYear: 1950,
          builtYear: 1948,
          confidence: 'approximate',
          sourceRefs: ['osm-overpass-test'],
        },
        sourceRefs: ['osm-overpass-test'],
      },
      {
        slug: 't-2',
        name: 'T2',
        districtSlug: 'downtown',
        baseValue: 150,
        historical: {
          era: 'postwar',
          activationYear: 1962,
          builtYear: 1960,
          openedYear: 1962,
          retiredYear: 2005,
          demolishedYear: 2008,
          predecessorSlug: 't-1',
          successorSlug: 'p-1',
          sourceRefs: ['osm-overpass-test'],
          confidence: 'confirmed',
        },
        sourceRefs: ['osm-overpass-test'],
      },
    ],
    edges: [
      {
        a: 't-1',
        b: 't-2',
        edgeType: 'border',
        historical: {
          openedYear: 1955,
          retiredYear: 2010,
          confidence: 'confirmed',
          sourceRefs: ['osm-overpass-test'],
        },
      },
    ],
    properties: [
      {
        slug: 'p-1',
        name: 'City Hall',
        territorySlug: 't-1',
        baseValue: 200,
        publicNameSafe: true,
        privacyClass: 'PUBLIC_CIVIC',
        historical: {
          builtYear: 1960,
          confidence: 'confirmed',
          sourceRefs: ['osm-overpass-test'],
        },
        sourceRefs: ['osm-overpass-test'],
      },
    ],
    landmarks: [
      {
        slug: 'l-1',
        name: 'Founders Statue',
        territorySlug: 't-2',
        point: { lat: 40.8, lng: -81.37 },
        privacyClass: 'CULTURAL',
        historical: {
          builtYear: 1975,
          confidence: 'unknown',
          sourceRefs: ['osm-overpass-test'],
        },
        sourceRefs: ['osm-overpass-test'],
      },
    ],
    compilerVersion: '1.0.0',
    sourceSnapshotVersion: 'test-slice-v1',
    generatedAt: '2026-09-12T00:00:00.000Z',
    approvedAt: '2026-09-12T00:00:00.000Z',
    approvedBy: 'reviewer@example.com',
    checksum: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    provenance,
  };
}

describe('GRID compiler type contracts (Task 1 — types only)', () => {
  it('accepts a minimal legacy-shaped GridCityPackage with none of the new optional fields', () => {
    const pkg = minimalLegacyPackage();
    expect(validateGridCityPackage(pkg)).toEqual({ ok: true, errors: [] });
  });

  it('accepts a fully populated GridCityPackage exercising every new optional field', () => {
    const pkg = fullyPopulatedPackage();
    const result = validateGridCityPackage(pkg);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
