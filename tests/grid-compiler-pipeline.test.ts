import { describe, it, expect } from 'vitest';
import { compileCityPackage } from '../lib/grid/compiler/pipeline';
import { mapToCityPackage, crossCheckAdjacency } from '../lib/grid/compiler/map-to-city-package';
import { normalizeRawGeography } from '../lib/grid/compiler/normalize';
import type { GridCompilerOptions, GridRawGeography } from '../lib/grid/compiler/types';
import type { GridCityPackage } from '../lib/grid/core/types';
import tinyCityRawJson from './fixtures/grid-compiler/tiny-city-raw.json';

const tinyCityRaw = tinyCityRawJson as GridRawGeography;

const testCityMeta: GridCityPackage['city'] = {
  slug: 'tiny-metro',
  name: 'Tiny Metro',
  regionCode: 'TM',
  countryCode: 'US',
  timezone: 'America/New_York',
  mapCenter: { lat: 1.0, lng: 1.0 },
};

const testSeasonTemplate: GridCityPackage['seasonTemplate'] = {
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

const defaultOptions: GridCompilerOptions = {
  compilerVersion: '1.0.0',
  sourceSnapshotVersion: 'tiny-v1',
  generatedAt: '2026-09-12T12:00:00.000Z',
};

describe('GRID Compiler Pipeline', () => {
  // =========================================================================
  // CENTERPIECE DETERMINISM TESTS
  // =========================================================================
  describe('CENTERPIECE: Determinism and Content Sensitivity', () => {
    it('compileCityPackage run twice over the same fixture produces byte-identical JSON.stringify(.package) output', () => {
      const run1 = compileCityPackage(tinyCityRaw, testSeasonTemplate, testCityMeta, defaultOptions);
      const run2 = compileCityPackage(tinyCityRaw, testSeasonTemplate, testCityMeta, defaultOptions);

      const json1 = JSON.stringify(run1.package);
      const json2 = JSON.stringify(run2.package);

      // Byte-identical serialized representation
      expect(json1).toBe(json2);
      expect(run1.package.checksum).toBe(run2.package.checksum);
      expect(run1.package.generatedAt).toBe(defaultOptions.generatedAt);
      expect(run2.package.generatedAt).toBe(defaultOptions.generatedAt);

      // Validation reports must also match exactly
      expect(JSON.stringify(run1.validation)).toBe(JSON.stringify(run2.validation));
      expect(run1.validation.ok).toBe(true);
      expect(run1.validation.issues).toHaveLength(0);
    });

    it('checksum changes when sourceSnapshotVersion changes, proving it is content-sensitive', () => {
      const baseRun = compileCityPackage(tinyCityRaw, testSeasonTemplate, testCityMeta, defaultOptions);

      const modifiedOptions: GridCompilerOptions = {
        ...defaultOptions,
        sourceSnapshotVersion: 'tiny-v2-updated',
      };

      const updatedRun = compileCityPackage(tinyCityRaw, testSeasonTemplate, testCityMeta, modifiedOptions);

      expect(updatedRun.package.sourceSnapshotVersion).toBe('tiny-v2-updated');
      expect(updatedRun.package.checksum).not.toBe(baseRun.package.checksum);
      expect(typeof updatedRun.package.checksum).toBe('string');
      expect(updatedRun.package.checksum).toHaveLength(64); // SHA-256 hex string
    });

    it('checksum changes when geography content changes', () => {
      const baseRun = compileCityPackage(tinyCityRaw, testSeasonTemplate, testCityMeta, defaultOptions);

      const alteredGeography: GridRawGeography = {
        ...tinyCityRaw,
        territories: [
          {
            ...tinyCityRaw.territories[0],
            baseValue: 999,
          },
          ...tinyCityRaw.territories.slice(1),
        ],
      };

      const alteredRun = compileCityPackage(alteredGeography, testSeasonTemplate, testCityMeta, defaultOptions);
      expect(alteredRun.package.checksum).not.toBe(baseRun.package.checksum);
    });
  });

  // =========================================================================
  // NORMALIZATION TESTS: Drop vs Silent Repair
  // =========================================================================
  describe('normalizeRawGeography', () => {
    it('drops invalid polygon geometry without silently repairing it and records GEOMETRY_INVALID issue', () => {
      // Bowtie self-intersecting polygon
      const invalidBowtieGeometry: GeoJSON.MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [2, 2],
              [0, 2],
              [2, 0],
              [0, 0],
            ],
          ],
        ],
      };

      const rawWithInvalid: GridRawGeography = {
        ...tinyCityRaw,
        territories: [
          ...tinyCityRaw.territories,
          {
            slug: 'territory-bad',
            name: 'Bad Territory',
            districtSlug: 'district-core',
            geometry: invalidBowtieGeometry,
            sourceRefs: ['tiny-prov-1'],
          },
        ],
        properties: [
          ...tinyCityRaw.properties,
          {
            slug: 'prop-bad',
            name: 'Bad Property',
            territorySlug: 'territory-alpha',
            geometry: invalidBowtieGeometry,
            privacyClass: 'PUBLIC_CIVIC',
            publicNameSafe: true,
            sourceRefs: ['tiny-prov-1'],
          },
        ],
      };

      const normalized = normalizeRawGeography(rawWithInvalid);

      // Dropped from clean returned arrays
      expect(normalized.territories.find((t) => t.slug === 'territory-bad')).toBeUndefined();
      expect(normalized.properties.find((p) => p.slug === 'prop-bad')).toBeUndefined();
      expect(normalized.territories).toHaveLength(tinyCityRaw.territories.length);
      expect(normalized.properties).toHaveLength(tinyCityRaw.properties.length);

      // Recorded as ERROR-severity GEOMETRY_INVALID issues in droppedFeatures
      expect(normalized.droppedFeatures).toHaveLength(2);

      const territoryIssue = normalized.droppedFeatures.find((i) => i.assetSlug === 'territory-bad');
      expect(territoryIssue).toBeDefined();
      expect(territoryIssue?.severity).toBe('ERROR');
      expect(territoryIssue?.code).toBe('GEOMETRY_INVALID');
      expect(territoryIssue?.assetType).toBe('territory');

      const propIssue = normalized.droppedFeatures.find((i) => i.assetSlug === 'prop-bad');
      expect(propIssue).toBeDefined();
      expect(propIssue?.severity).toBe('ERROR');
      expect(propIssue?.code).toBe('GEOMETRY_INVALID');
      expect(propIssue?.assetType).toBe('property');
    });

    it('throws on completely malformed raw input (structural authoring error)', () => {
      expect(() => normalizeRawGeography(null as unknown as GridRawGeography)).toThrow(
        /Invalid raw geography/,
      );

      expect(() =>
        normalizeRawGeography({
          ...tinyCityRaw,
          citySlug: '',
        }),
      ).toThrow(/missing or empty citySlug/);

      expect(() =>
        normalizeRawGeography({
          ...tinyCityRaw,
          cityBoundary: { type: 'MultiPolygon', coordinates: [] },
        }),
      ).toThrow(/missing or invalid cityBoundary/);
    });

    it('preserves valid point-only properties without geometry', () => {
      const rawWithPointOnly: GridRawGeography = {
        ...tinyCityRaw,
        properties: [
          {
            slug: 'prop-point-only',
            name: 'Point Only Property',
            territorySlug: 'territory-alpha',
            point: { lat: 1.0, lng: 1.0 },
            privacyClass: 'PUBLIC_CIVIC',
            publicNameSafe: true,
            sourceRefs: ['tiny-prov-1'],
          },
        ],
      };

      const normalized = normalizeRawGeography(rawWithPointOnly);
      expect(normalized.properties).toHaveLength(1);
      expect(normalized.properties[0].slug).toBe('prop-point-only');
      expect(normalized.droppedFeatures).toHaveLength(0);
    });
  });

  // =========================================================================
  // MAP TO CITY PACKAGE TESTS: Status, Metadata, Edge Cross-Check
  // =========================================================================
  describe('mapToCityPackage', () => {
    it('always outputs status DRAFT and stamps metadata', () => {
      const normalized = normalizeRawGeography(tinyCityRaw);
      const pkg = mapToCityPackage(normalized, testSeasonTemplate, testCityMeta, defaultOptions);

      expect(pkg.status).toBe('draft');
      expect(pkg.schemaVersion).toBe(1);
      expect(pkg.packageVersion).toBe(1);
      expect(pkg.compilerVersion).toBe('1.0.0');
      expect(pkg.sourceSnapshotVersion).toBe('tiny-v1');
      expect(pkg.generatedAt).toBe('2026-09-12T12:00:00.000Z');
      expect(pkg.checksum).toBeDefined();
      expect(pkg.checksum).toHaveLength(64);
    });

    it('computes adjacency automatically when raw.edges is absent', () => {
      const rawWithoutEdges = { ...tinyCityRaw, edges: undefined };
      const normalized = normalizeRawGeography(rawWithoutEdges);
      const pkg = mapToCityPackage(normalized, testSeasonTemplate, testCityMeta, defaultOptions);

      expect(pkg.edges).toHaveLength(1);
      expect(pkg.edges[0]).toEqual({
        a: 'territory-alpha',
        b: 'territory-beta',
      });
    });

    it('keeps raw.edges and cross-checks against computed adjacency, producing INFO issues for mismatches', () => {
      const rawWithExplicitEdges: GridRawGeography = {
        ...tinyCityRaw,
        edges: [
          // territory-alpha and territory-beta actually touch
          { a: 'territory-alpha', b: 'territory-beta', edgeType: 'border' },
          // non-touching corridor edge asserted by source
          { a: 'territory-alpha', b: 'corridor-zone', edgeType: 'corridor' },
        ],
      };

      const normalized = normalizeRawGeography(rawWithExplicitEdges);
      const edgeIssues: any[] = [];
      const pkg = mapToCityPackage(normalized, testSeasonTemplate, testCityMeta, defaultOptions, edgeIssues);

      // Explicit edges are kept, never silently replaced
      expect(pkg.edges).toHaveLength(2);
      expect(pkg.edges.some((e) => e.b === 'corridor-zone' || e.a === 'corridor-zone')).toBe(true);

      // Mismatch recorded as INFO severity
      expect(edgeIssues).toHaveLength(1);
      expect(edgeIssues[0].severity).toBe('INFO');
      expect(edgeIssues[0].code).toBe('ADJACENCY_CROSS_CHECK_MISMATCH');
      expect(edgeIssues[0].message).toContain('explicit edge');
    });

    it('crossCheckAdjacency detects both extra and missing edges as INFO issues', () => {
      const explicit = [
        { a: 't1', b: 't2' },
        { a: 't1', b: 't3' }, // extra in explicit
      ];
      const computed = [
        { a: 't1', b: 't2' },
        { a: 't2', b: 't4' }, // extra in computed (missing in explicit)
      ];

      const issues = crossCheckAdjacency(explicit, computed);
      expect(issues).toHaveLength(2);
      expect(issues.every((i) => i.severity === 'INFO')).toBe(true);
      expect(issues.every((i) => i.code === 'ADJACENCY_CROSS_CHECK_MISMATCH')).toBe(true);

      const explicitMismatch = issues.find((i) => i.message.includes('explicit edge'));
      const computedMismatch = issues.find((i) => i.message.includes('computed geometric edge'));

      expect(explicitMismatch?.assetSlug).toBe('t1::t3');
      expect(computedMismatch?.assetSlug).toBe('t2::t4');
    });
  });

  // =========================================================================
  // PIPELINE INTEGRATION TESTS
  // =========================================================================
  describe('compileCityPackage Orchestration', () => {
    it('compiles clean fixture with zero validation errors and draft status', () => {
      const result = compileCityPackage(tinyCityRaw, testSeasonTemplate, testCityMeta, defaultOptions);

      expect(result.package.status).toBe('draft');
      expect(result.validation.ok).toBe(true);
      expect(result.validation.issues.filter((i) => i.severity === 'ERROR')).toHaveLength(0);
      expect(result.package.districts).toHaveLength(1);
      expect(result.package.territories).toHaveLength(2);
      expect(result.package.properties).toHaveLength(1);
      expect(result.package.landmarks).toHaveLength(1);
      expect(result.package.edges).toHaveLength(1);
    });

    it('surfaces droppedFeatures as validation errors in the compiled result', () => {
      const badGeometry: GeoJSON.MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [1, 1],
              [0, 1],
              [1, 0],
              [0, 0],
            ],
          ],
        ],
      };

      const rawWithBadTerritory: GridRawGeography = {
        ...tinyCityRaw,
        territories: [
          ...tinyCityRaw.territories,
          {
            slug: 'territory-corrupted',
            name: 'Corrupted Territory',
            districtSlug: 'district-core',
            geometry: badGeometry,
            sourceRefs: ['tiny-prov-1'],
          },
        ],
      };

      const result = compileCityPackage(rawWithBadTerritory, testSeasonTemplate, testCityMeta, defaultOptions);

      // Dropped feature causes validation.ok to be false because of ERROR severity
      expect(result.validation.ok).toBe(false);
      const geomError = result.validation.issues.find((i) => i.assetSlug === 'territory-corrupted');
      expect(geomError).toBeDefined();
      expect(geomError?.severity).toBe('ERROR');
      expect(geomError?.code).toBe('GEOMETRY_INVALID');

      // The corrupt territory is not in the compiled package
      expect(result.package.territories.find((t) => t.slug === 'territory-corrupted')).toBeUndefined();
    });

    it('surfaces edge cross-check mismatches as INFO in the compiled result without failing ok status', () => {
      const rawWithExtraEdge: GridRawGeography = {
        ...tinyCityRaw,
        edges: [
          { a: 'territory-alpha', b: 'territory-beta' },
          { a: 'territory-alpha', b: 'territory-beta' }, // handled cleanly
        ],
      };

      const result = compileCityPackage(rawWithExtraEdge, testSeasonTemplate, testCityMeta, defaultOptions);
      expect(result.package.status).toBe('draft');
    });

    it('hard invariant: package.status is draft even if compiler caller attempts to set ready', () => {
      const result = compileCityPackage(tinyCityRaw, testSeasonTemplate, testCityMeta, defaultOptions);
      expect(result.package.status).toBe('draft');
      expect((result.package as any).status).not.toBe('ready');
    });
  });
});
