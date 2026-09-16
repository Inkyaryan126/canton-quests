import { describe, expect, it } from 'vitest';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { normalizeRoadSourceFeatures } from '../lib/grid/roads/normalize';
import type { GridRoadSourceFeature } from '../lib/grid/roads/types';

describe('GRID road-network source normalization', () => {
  it('normalizes LineString and MultiLineString parts deterministically', () => {
    const input: GridRoadSourceFeature[] = [
      {
        roadClass: 'secondary',
        properties: { oid: '20', name: ' Beta ', mtfcc: 'S1200', routeType: 'S' },
        geometry: {
          type: 'MultiLineString',
          coordinates: [
            [[2, 2], [3, 3]],
            [[3, 3], [4, 4]],
          ],
        },
      },
      {
        roadClass: 'primary',
        properties: { oid: '10', name: 'Alpha', mtfcc: 'S1100', routeType: 'I' },
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
      },
    ];

    const first = normalizeRoadSourceFeatures(input);
    const second = normalizeRoadSourceFeatures(input);
    expect(second).toEqual(first);
    expect(first.map((segment) => segment.id)).toEqual([
      'primary:10:0',
      'secondary:20:0',
      'secondary:20:1',
    ]);
    expect(first[1].name).toBe('Beta');
  });
  it('loads the committed Canton Census road snapshots with expected source counts', () => {
    const features = loadCantonRoadSourceFeatures();
    const counts = features.reduce(
      (acc, feature) => {
        acc[feature.roadClass] += 1;
        return acc;
      },
      { primary: 0, secondary: 0, local: 0 },
    );

    expect(counts).toEqual({ primary: 12, secondary: 67, local: 2251 });
  });

  it('expands real Canton road geometries into deterministic line segments', () => {
    const first = normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures());
    const second = normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures());

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first).toHaveLength(3456);

    const byClass = first.reduce(
      (acc, segment) => {
        acc[segment.roadClass] += 1;
        return acc;
      },
      { primary: 0, secondary: 0, local: 0 },
    );
    expect(byClass).toEqual({ primary: 22, secondary: 225, local: 3209 });
    expect(new Set(first.map((segment) => segment.id)).size).toBe(first.length);
  });
});
