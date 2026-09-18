import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileCityPackage } from '../lib/grid/compiler/pipeline';
import type { GridCompilerOptions, GridRawGeography } from '../lib/grid/compiler/types';
import { validateGridCityPackage } from '../lib/grid/core/city-package';
import type { GridCityPackage } from '../lib/grid/core/types';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';
import tinyCityRawJson from './fixtures/grid-compiler/tiny-city-raw.json';

const CITY_002_SLUG = 'city-002-testbed';
const GENERATED_AT = '2026-09-18T04:00:00.000Z';

const city002Meta: GridCityPackage['city'] = {
  slug: CITY_002_SLUG,
  name: 'City Two Testbed',
  regionCode: 'T2',
  countryCode: 'US',
  timezone: 'America/Chicago',
  mapCenter: { lat: 5, lng: 5 },
};

const city002Season: GridCityPackage['seasonTemplate'] = {
  slug: 'launch-season',
  name: 'Launch Season',
  durationDays: 21,
  surgeHours: 6,
  balance: {
    startingCredits: 700,
    startingInfluence: 80,
    maxCommandPoints: 12,
    commandPointRegenMinutes: 45,
  },
};

const options: GridCompilerOptions = {
  compilerVersion: '1.0.0',
  sourceSnapshotVersion: 'city-002-synthetic-v1',
  generatedAt: GENERATED_AT,
};

function rawForCity(citySlug: string): GridRawGeography {
  const raw = structuredClone(tinyCityRawJson) as GridRawGeography;
  raw.citySlug = citySlug;
  return raw;
}

function compileCity002() {
  return compileCityPackage(
    rawForCity(CITY_002_SLUG),
    city002Season,
    city002Meta,
    options,
  );
}

function sourceFilesUnder(relativeDir: string): string[] {
  const absoluteDir = path.join(process.cwd(), relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(relativePath);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
}

describe('Grid City #002 portability acceptance', () => {
  it('compiles and validates a second non-Canton city through unchanged Grid contracts', () => {
    const compiled = compileCity002();

    expect(compiled.validation.ok).toBe(true);
    expect(compiled.validation.issues).toEqual([]);
    expect(validateGridCityPackage(compiled.package)).toEqual({ ok: true, errors: [] });
    expect(compiled.package.city).toEqual(city002Meta);
    expect(compiled.package.seasonTemplate.slug).toBe('launch-season');
    expect(compiled.package.sourceSnapshotVersion).toBe('city-002-synthetic-v1');
    expect(JSON.stringify(compiled.package)).not.toMatch(/canton|40\.7989|-81\.3748/i);
  });

  it('projects City #002 with the existing world projector and no special-case runtime code', () => {
    const projection = buildGridWorldProjection(compileCity002().package);

    expect(projection.city.slug).toBe(CITY_002_SLUG);
    expect(projection.city.name).toBe('City Two Testbed');
    expect(projection.source).toBe('compiled-package');
    expect(projection.readOnly).toBe(true);
    expect(projection.season.runtimeActive).toBe(false);
    expect(projection.counts.territories).toBe(2);
    expect(projection.counts.properties).toBe(1);
    expect(projection.counts.occupiedTerritories).toBe(0);
    expect(projection.counts.occupiedProperties).toBe(0);
    expect(projection.territories.every((territory) => territory.ownership === 'neutral')).toBe(true);
  });

  it('is deterministic and produces a city-specific package identity', () => {
    const first = compileCity002().package;
    const second = compileCity002().package;
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.checksum).toBe(second.checksum);

    const city001LikeMeta: GridCityPackage['city'] = {
      ...city002Meta,
      slug: 'city-001-testbed',
      name: 'City One Testbed',
    };
    const city001Like = compileCityPackage(
      rawForCity('city-001-testbed'),
      city002Season,
      city001LikeMeta,
      options,
    ).package;

    expect(city001Like.checksum).not.toBe(first.checksum);
  });

  it('keeps reusable Core, server, and simulation code free of Canton hardcoding', () => {
    const files = [
      ...sourceFilesUnder('lib/grid/core'),
      ...sourceFilesUnder('lib/grid/server'),
      ...sourceFilesUnder('lib/grid/sim'),
    ];

    const leaks = files.flatMap((file) => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      return /canton-oh|40\.7989|-81\.3748|cities\/canton/i.test(source) ? [file] : [];
    });

    expect(leaks).toEqual([]);
  });
});
