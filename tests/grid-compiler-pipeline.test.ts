import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { GridCityPackage } from '../lib/grid/core/types';
import type { GridCompilerOptions, GridRawGeography } from '../lib/grid/compiler/types';
import { normalizeRawGeography } from '../lib/grid/compiler/normalize';
import { computeAdjacencyMismatchIssues, mapToCityPackage } from '../lib/grid/compiler/map-to-city-package';
import { compileCityPackage } from '../lib/grid/compiler/pipeline';

function loadTinyCityRaw(): GridRawGeography {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'grid-compiler', 'tiny-city-raw.json');
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as GridRawGeography;
}

function withoutExplicitEdges(raw: GridRawGeography): GridRawGeography {
  const copy: GridRawGeography = { ...raw };
  delete copy.edges;
  return copy;
}

const seasonTemplate: GridCityPackage['seasonTemplate'] = {
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

const cityMeta: GridCityPackage['city'] = {
  slug: 'tiny-city',
  name: 'Tiny City',
  regionCode: 'OH',
  countryCode: 'US',
  timezone: 'America/New_York',
  mapCenter: { lat: 0.5, lng: 0.5 },
};

const baseOptions: GridCompilerOptions = {
  compilerVersion: '1.0.0',
  sourceSnapshotVersion: 'tiny-city-v1',
  generatedAt: '2026-01-01T00:00:00.000Z',
};

describe('normalizeRawGeography', () => {
  it('drops invalid geometry instead of repairing it, and records it in droppedFeatures', () => {
    const raw = loadTinyCityRaw();
    const normalized = normalizeRawGeography(raw);

    expect(normalized.districts.map((d) => d.slug)).toEqual(['d1']);
    expect(normalized.districts.some((d) => d.slug === 'd-bad')).toBe(false);

    expect(normalized.droppedFeatures).toHaveLength(1);
    expect(normalized.droppedFeatures[0]).toMatchObject({
      severity: 'ERROR',
      code: 'GEOMETRY_INVALID',
      assetType: 'district',
      assetSlug: 'd-bad',
    });
  });

  it('throws on structurally malformed input rather than silently coping', () => {
    const raw = loadTinyCityRaw();
    const malformed = { ...raw, citySlug: '' };
    expect(() => normalizeRawGeography(malformed as GridRawGeography)).toThrow();
  });

  it('keeps valid territories/properties/landmarks untouched', () => {
    const raw = loadTinyCityRaw();
    const normalized = normalizeRawGeography(raw);
    expect(normalized.territories.map((t) => t.slug).sort()).toEqual(['t1', 't2', 't3']);
    expect(normalized.properties.map((p) => p.slug)).toEqual(['p1']);
    expect(normalized.landmarks.map((l) => l.slug)).toEqual(['lm1']);
  });
});

describe('mapToCityPackage', () => {
  it('always stamps status: draft and never ready', () => {
    const normalized = normalizeRawGeography(loadTinyCityRaw());
    const pkg = mapToCityPackage(normalized, seasonTemplate, cityMeta, baseOptions);
    expect(pkg.status).toBe('draft');
  });

  it('stamps compilerVersion, sourceSnapshotVersion, generatedAt, and checksum', () => {
    const normalized = normalizeRawGeography(loadTinyCityRaw());
    const pkg = mapToCityPackage(normalized, seasonTemplate, cityMeta, baseOptions);

    expect(pkg.compilerVersion).toBe('1.0.0');
    expect(pkg.sourceSnapshotVersion).toBe('tiny-city-v1');
    expect(pkg.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(typeof pkg.checksum).toBe('string');
    expect(pkg.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps explicit edges verbatim rather than silently overriding them with computed adjacency', () => {
    const normalized = normalizeRawGeography(loadTinyCityRaw());
    const pkg = mapToCityPackage(normalized, seasonTemplate, cityMeta, baseOptions);

    // t2-t3 is present in the source's explicit edge list even though the
    // two territories' geometry is not actually adjacent -- it must survive
    // mapping unchanged, not be dropped/replaced by the computed graph.
    const edgeKeys = new Set(pkg.edges.map((e) => [e.a, e.b].sort().join('::')));
    expect(edgeKeys.has('t1::t2')).toBe(true);
    expect(edgeKeys.has('t2::t3')).toBe(true);
    expect(pkg.edges).toHaveLength(2);
  });

  it('reports explicit/computed adjacency mismatches as INFO issues without altering the edge list', () => {
    const normalized = normalizeRawGeography(loadTinyCityRaw());
    const mismatches = computeAdjacencyMismatchIssues(normalized);

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      severity: 'INFO',
      code: 'ADJACENCY_MISMATCH',
      assetType: 'edge',
      assetSlug: 't2::t3',
    });
  });

  it('returns no mismatch issues when the source supplies no explicit edges', () => {
    const normalized = normalizeRawGeography(withoutExplicitEdges(loadTinyCityRaw()));
    expect(computeAdjacencyMismatchIssues(normalized)).toEqual([]);
  });

  it('computes adjacency from geometry when the source supplies no explicit edges', () => {
    const normalized = normalizeRawGeography(withoutExplicitEdges(loadTinyCityRaw()));
    const pkg = mapToCityPackage(normalized, seasonTemplate, cityMeta, baseOptions);

    const edgeKeys = new Set(pkg.edges.map((e) => [e.a, e.b].sort().join('::')));
    expect(edgeKeys).toEqual(new Set(['t1::t2']));
  });
});

describe('compileCityPackage', () => {
  it('never sets status to ready', () => {
    const raw = loadTinyCityRaw();
    const result = compileCityPackage(raw, seasonTemplate, cityMeta, baseOptions);
    expect(result.package.status).toBe('draft');
    expect(result.package.status).not.toBe('ready');
  });

  it('surfaces the dropped invalid geometry as an ERROR in the final validation report', () => {
    const raw = loadTinyCityRaw();
    const result = compileCityPackage(raw, seasonTemplate, cityMeta, baseOptions);
    const dropped = result.validation.issues.find(
      (issue) => issue.code === 'GEOMETRY_INVALID' && issue.assetSlug === 'd-bad',
    );
    expect(dropped).toBeDefined();
    expect(dropped?.severity).toBe('ERROR');
  });

  it('surfaces the explicit/computed adjacency mismatch as an INFO issue', () => {
    const raw = loadTinyCityRaw();
    const result = compileCityPackage(raw, seasonTemplate, cityMeta, baseOptions);
    const mismatch = result.validation.issues.find(
      (issue) => issue.code === 'ADJACENCY_MISMATCH' && issue.assetSlug === 't2::t3',
    );
    expect(mismatch).toBeDefined();
    expect(mismatch?.severity).toBe('INFO');
  });

  // --- The single most important test in this file ---
  it('is deterministic: two runs over identical input with a fixed generatedAt produce byte-identical package JSON', () => {
    const raw = loadTinyCityRaw();

    const first = compileCityPackage(raw, seasonTemplate, cityMeta, baseOptions);
    const second = compileCityPackage(raw, seasonTemplate, cityMeta, baseOptions);

    const firstJson = JSON.stringify(first.package);
    const secondJson = JSON.stringify(second.package);

    expect(firstJson).toBe(secondJson);
  });

  it('is deterministic across freshly-parsed copies of the same raw fixture, not just the same object reference', () => {
    const first = compileCityPackage(loadTinyCityRaw(), seasonTemplate, cityMeta, baseOptions);
    const second = compileCityPackage(loadTinyCityRaw(), seasonTemplate, cityMeta, baseOptions);

    expect(JSON.stringify(first.package)).toBe(JSON.stringify(second.package));
    expect(JSON.stringify(first.validation)).toBe(JSON.stringify(second.validation));
  });

  it('changes the checksum when sourceSnapshotVersion changes, proving it is content-sensitive', () => {
    const raw = loadTinyCityRaw();
    const first = compileCityPackage(raw, seasonTemplate, cityMeta, baseOptions);
    const second = compileCityPackage(raw, seasonTemplate, cityMeta, {
      ...baseOptions,
      sourceSnapshotVersion: 'tiny-city-v2',
    });

    expect(first.package.checksum).not.toBe(second.package.checksum);
  });

  it('does not change the checksum based on generatedAt alone once content is fixed', () => {
    const raw = loadTinyCityRaw();
    const first = compileCityPackage(raw, seasonTemplate, cityMeta, baseOptions);
    const second = compileCityPackage(raw, seasonTemplate, cityMeta, {
      ...baseOptions,
      generatedAt: '2030-06-15T12:00:00.000Z',
    });

    expect(first.package.checksum).toBe(second.package.checksum);
    expect(first.package.generatedAt).not.toBe(second.package.generatedAt);
  });
});
