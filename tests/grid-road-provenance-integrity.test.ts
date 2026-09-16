import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(process.cwd(), 'research/grid/canton/source-data');

function readJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')) as T;
}

function sha256(relative: string): string {
  return createHash('sha256')
    .update(fs.readFileSync(path.join(root, relative)))
    .digest('hex');
}

type ClipLayer = {
  containmentViolations: number;
  inputFeatures: number;
  outputFeatures: number;
  outputLineParts: number;
  outputSha256: string;
  sourceSha256: string;
  source: string;
  output: string;
};

type ClipReport = {
  schemaVersion: number;
  cityId: string;
  boundarySha256: string;
  layers: Record<'primary' | 'secondary' | 'local', ClipLayer>;
};

type Provenance = {
  schemaVersion: number;
  cityId: string;
  censusPlaceGeoid: string;
  coordinateReferenceSystem: string;
  humanApprovalRequired: boolean;
  sources: Array<{ file: string; sha256: string; provider: string; service: string }>;
};

describe('GRID Canton road provenance integrity', () => {
  it('pins Canton municipal identity and requires human approval', () => {
    const provenance = readJson<Provenance>('provenance.json');
    expect(provenance).toMatchObject({
      schemaVersion: 1,
      cityId: 'canton-oh',
      censusPlaceGeoid: '3912000',
      coordinateReferenceSystem: 'EPSG:4326',
      humanApprovalRequired: true,
    });
    expect(provenance.sources.every((source) => source.provider === 'U.S. Census Bureau')).toBe(true);
    expect(provenance.sources.every((source) => source.service === 'TIGERweb')).toBe(true);
  });

  it('verifies every acquired raw snapshot against its recorded SHA-256', () => {
    const provenance = readJson<Provenance>('provenance.json');
    for (const source of provenance.sources) {
      expect(sha256(source.file), source.file).toBe(source.sha256);
    }
  });

  it('verifies every processed road snapshot against the clip report SHA-256', () => {
    const report = readJson<ClipReport>('processed/clip-report.json');
    for (const roadClass of ['primary', 'secondary', 'local'] as const) {
      const layer = report.layers[roadClass];
      const relativeOutput = layer.output.replace('research/grid/canton/source-data/', '');
      const relativeSource = layer.source.replace('research/grid/canton/source-data/', '');
      expect(sha256(relativeOutput), `${roadClass} processed`).toBe(layer.outputSha256);
      expect(sha256(relativeSource), `${roadClass} raw source`).toBe(layer.sourceSha256);
    }
  });

  it('proves the accepted clip stayed inside Canton and preserves expected totals', () => {
    const report = readJson<ClipReport>('processed/clip-report.json');
    expect(report.cityId).toBe('canton-oh');
    expect(report.boundarySha256).toBe(sha256('raw/canton-city-boundary.geojson'));

    const layers = Object.values(report.layers);
    expect(layers.reduce((sum, layer) => sum + layer.containmentViolations, 0)).toBe(0);
    expect(layers.reduce((sum, layer) => sum + layer.outputFeatures, 0)).toBe(2330);
    expect(layers.reduce((sum, layer) => sum + layer.outputLineParts, 0)).toBe(3456);
    expect(report.layers.primary.outputFeatures).toBe(12);
    expect(report.layers.secondary.outputFeatures).toBe(67);
    expect(report.layers.local.outputFeatures).toBe(2251);
  });
});
