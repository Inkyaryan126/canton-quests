import { describe, expect, it } from 'vitest';
import { validateGridCityPackage } from '../lib/grid/core/city-package';
import type { GridCityPackage } from '../lib/grid/core/types';
import type {
  GridProvenanceRecord,
  GridRawGeography,
  GridCompilerOptions,
  GridValidationIssue,
  GridCompiledPackageResult,
} from '../lib/grid/compiler/types';

const minimalLegacyPackage: GridCityPackage = {
  schemaVersion: 1,
  packageVersion: 1,
  status: 'draft',
  city: {
    slug: 'legacy-city',
    name: 'Legacy City',
    regionCode: 'OH',
    countryCode: 'US',
    timezone: 'America/New_York',
    mapCenter: { lat: 0, lng: 0 },
  },
  seasonTemplate: {
    slug: 'season',
    name: 'Season',
    durationDays: 30,
    surgeHours: 72,
    balance: {
      startingCredits: 100,
      startingInfluence: 10,
      maxCommandPoints: 5,
      commandPointRegenMinutes: 60,
    },
  },
  districts: [],
  territories: [],
  edges: [],
  properties: [],
  landmarks: [],
};

describe('Grid compiler type contracts', () => {
  it('a minimal legacy-shaped GridCityPackage (no new fields) still passes validateGridCityPackage', () => {
    const result = validateGridCityPackage(minimalLegacyPackage);
    expect(result.ok).toBe(true);
  });

  it('a fully-populated package using every new optional field type-checks and still passes validateGridCityPackage', () => {
    const provenance: GridProvenanceRecord = {
      id: 'src-1',
      sourceName: 'Test Source',
      sourceUrl: 'https://example.com/source',
      license: 'ODbL 1.0',
      retrievedAt: '2026-09-12',
      transformation: 'none',
      attribution: '© Test',
      confidence: 'confirmed',
    };

    const fullPackage: GridCityPackage = {
      ...minimalLegacyPackage,
      compilerVersion: '1.0.0',
      sourceSnapshotVersion: 'test-slice-v1',
      generatedAt: '2026-09-12T00:00:00.000Z',
      checksum: 'deadbeef',
      provenance: [provenance],
      districts: [{ slug: 'd1', name: 'District 1', sourceRefs: [provenance.id] }],
      territories: [
        {
          slug: 't1',
          name: 'Territory 1',
          districtSlug: 'd1',
          baseValue: 0,
          sourceRefs: [provenance.id],
          historical: {
            era: 'founding',
            activationYear: 1900,
            confidence: 'approximate',
            sourceRefs: [provenance.id],
          },
        },
      ],
      edges: [],
      properties: [
        {
          slug: 'p1',
          name: 'Property 1',
          territorySlug: 't1',
          baseValue: 0,
          publicNameSafe: true,
          privacyClass: 'COMMERCIAL',
          sourceRefs: [provenance.id],
        },
      ],
      landmarks: [
        {
          slug: 'l1',
          name: 'Landmark 1',
          territorySlug: 't1',
          point: { lat: 1, lng: 1 },
          privacyClass: 'PUBLIC_CIVIC',
          sourceRefs: [provenance.id],
        },
      ],
    };

    const result = validateGridCityPackage(fullPackage);
    expect(result.ok).toBe(true);
  });

  it('compiler types describe a raw-geography input without depending on any city-specific data', () => {
    const raw: GridRawGeography = {
      citySlug: 'test-city',
      cityBoundary: { type: 'MultiPolygon', coordinates: [] },
      districts: [],
      territories: [],
      properties: [],
      landmarks: [],
      provenance: [],
    };
    const options: GridCompilerOptions = {
      compilerVersion: '1.0.0',
      sourceSnapshotVersion: 'test-slice-v1',
    };
    const issue: GridValidationIssue = {
      severity: 'ERROR',
      code: 'GEOMETRY_INVALID',
      message: 'example',
    };

    expect(raw.citySlug).toBe('test-city');
    expect(options.compilerVersion).toBe('1.0.0');
    expect(issue.severity).toBe('ERROR');

    // Type-level only: confirms GridCompiledPackageResult composes cleanly.
    const result: GridCompiledPackageResult = {
      package: minimalLegacyPackage,
      validation: { ok: true, issues: [] },
    };
    expect(result.validation.ok).toBe(true);
  });
});
