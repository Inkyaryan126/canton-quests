import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { cantonRawGeography } from '../lib/grid/cities/canton/geography/raw-geography';
import { compileCityPackage } from '../lib/grid/compiler/pipeline';
import type { GridRawGeography } from '../lib/grid/compiler/types';
import { runCityValidation } from '../lib/grid/compiler/validate-package';
import { generateSyntheticGeography } from '../lib/grid/sim/synthetic-geography';

function tsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(full);
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
  });
}

function squareBoundary(width: number, height: number): GeoJSON.MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: [[[[0, 0], [width, 0], [width, height], [0, height], [0, 0]]]],
  };
}

describe('GRID City Compiler final acceptance', () => {
  it('keeps city-specific names out of geo and compiler architecture layers', () => {
    const roots = ['lib/grid/geo', 'lib/grid/compiler'].map((dir) => path.resolve(process.cwd(), dir));
    const offenders = roots.flatMap(tsFiles).filter((filename) =>
      /canton|stark county|ohio/i.test(fs.readFileSync(filename, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
  it('compiles real Canton geography deterministically', () => {
    const options = {
      compilerVersion: '1.0.0',
      sourceSnapshotVersion: 'canton-downtown-slice-v1',
      generatedAt: '2026-09-13T12:00:00.000Z',
    };
    const first = compileCityPackage(
      cantonRawGeography,
      cantonFoundingSeasonPackage.seasonTemplate,
      cantonFoundingSeasonPackage.city,
      options,
    );
    const second = compileCityPackage(
      cantonRawGeography,
      cantonFoundingSeasonPackage.seasonTemplate,
      cantonFoundingSeasonPackage.city,
      options,
    );

    expect(JSON.stringify(first.package)).toBe(JSON.stringify(second.package));
    expect(first.package.checksum).toBe(second.package.checksum);
    expect(first.validation.ok).toBe(true);
  });

  it('has zero ERROR validation issues for the real compiled Canton package', () => {
    const report = runCityValidation(cantonFoundingSeasonPackage, cantonRawGeography);
    const errors = report.issues.filter((issue) => issue.severity === 'ERROR');
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  });
  it('compiles a 500-territory synthetic package and checks full adjacency', () => {
    const synthetic = generateSyntheticGeography(500, 42);
    const raw: GridRawGeography = {
      citySlug: 'synthetic-scale',
      cityBoundary: squareBoundary(23, 22),
      districts: synthetic.districts,
      territories: synthetic.territories,
      properties: [],
      landmarks: [],
      provenance: [],
    };
    const result = compileCityPackage(
      raw,
      cantonFoundingSeasonPackage.seasonTemplate,
      {
        slug: 'synthetic-scale',
        name: 'Synthetic Scale City',
        regionCode: 'TS',
        countryCode: 'US',
        timezone: 'America/New_York',
        mapCenter: { lat: 11, lng: 11.5 },
      },
      {
        compilerVersion: '1.0.0',
        sourceSnapshotVersion: 'synthetic-500-v1',
        generatedAt: '2026-09-13T12:00:00.000Z',
      },
    );

    expect(result.package.territories).toHaveLength(500);
    expect(result.validation.issues.filter((issue) => issue.severity === 'ERROR')).toHaveLength(0);

    const neighborCounts = new Map(result.package.territories.map((territory) => [territory.slug, 0]));
    for (const edge of result.package.edges) {
      neighborCounts.set(edge.a, (neighborCounts.get(edge.a) ?? 0) + 1);
      neighborCounts.set(edge.b, (neighborCounts.get(edge.b) ?? 0) + 1);
    }
    for (const neighbors of neighborCounts.values()) expect(neighbors).toBeGreaterThan(0);
  });
});
