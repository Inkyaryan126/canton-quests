import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GridProvenanceRecord } from '../lib/grid/compiler/types';

const sourcesDir = path.resolve(process.cwd(), 'lib/grid/cities/canton/sources');
const provenance = JSON.parse(
  fs.readFileSync(path.join(sourcesDir, 'provenance.json'), 'utf8'),
) as GridProvenanceRecord[];

const requiredProvenanceFields: Array<keyof GridProvenanceRecord> = [
  'id',
  'sourceName',
  'sourceUrl',
  'license',
  'retrievedAt',
  'transformation',
  'attribution',
  'confidence',
];

describe('GRID Canton source provenance', () => {
  it('has complete, unique provenance records', () => {
    expect(provenance.length).toBeGreaterThan(0);
    expect(new Set(provenance.map((row) => row.id)).size).toBe(provenance.length);

    for (const row of provenance) {
      for (const field of requiredProvenanceFields) {
        expect(String(row[field] ?? '').trim(), `${row.id} missing ${field}`).not.toBe('');
      }
    }
  });

  it('gives every GeoJSON feature valid sourceRefs and excludes owner fields', () => {
    const provenanceIds = new Set(provenance.map((row) => row.id));
    const geojsonFiles = fs.readdirSync(sourcesDir).filter((name) => name.endsWith('.geojson')).sort();

    expect(geojsonFiles).toEqual([
      'canton-boundary.geojson',
      'canton-downtown-districts.geojson',
      'canton-downtown-landmarks.geojson',
      'canton-downtown-properties.geojson',
      'canton-downtown-territories.geojson',
    ]);

    for (const filename of geojsonFiles) {
      const collection = JSON.parse(fs.readFileSync(path.join(sourcesDir, filename), 'utf8')) as {
        features: Array<{ properties?: Record<string, unknown> }>;
      };
      expect(collection.features.length, filename).toBeGreaterThan(0);

      for (const feature of collection.features) {
        const properties = feature.properties ?? {};
        const sourceRefs = properties.sourceRefs as string[] | undefined;
        expect(Array.isArray(sourceRefs), filename).toBe(true);
        expect(sourceRefs?.length ?? 0, filename).toBeGreaterThan(0);
        for (const sourceRef of sourceRefs ?? []) {
          expect(provenanceIds.has(sourceRef), `${filename}: unknown sourceRef ${sourceRef}`).toBe(true);
        }
        expect(properties).not.toHaveProperty('owner');
        expect(properties).not.toHaveProperty('owner_name');
      }
    }
  });

  it('carries the required OpenStreetMap attribution exactly', () => {
    const osm = provenance.find((row) => row.id.startsWith('osm-overpass-'));
    expect(osm?.license).toBe('ODbL 1.0');
    expect(osm?.attribution).toBe('© OpenStreetMap contributors');
  });
});
