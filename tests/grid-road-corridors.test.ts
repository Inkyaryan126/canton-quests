import { describe, expect, it } from 'vitest';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { buildRoadCorridorIndex } from '../lib/grid/roads/corridors';
import { buildRoadGraph } from '../lib/grid/roads/graph';
import { normalizeRoadSourceFeatures } from '../lib/grid/roads/normalize';
import type { GridRoadSourceFeature } from '../lib/grid/roads/types';

function fixtureGraph() {
  const features: GridRoadSourceFeature[] = [
    {
      roadClass: 'local',
      properties: { oid: 'a', name: 'A St', mtfcc: 'S1400', routeType: null },
      geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0], [2, 0]] },
    },
    {
      roadClass: 'local',
      properties: { oid: 'b', name: 'A St', mtfcc: 'S1400', routeType: null },
      geometry: { type: 'LineString', coordinates: [[10, 0], [11, 0]] },
    },
    {
      roadClass: 'local',
      properties: { oid: 'c', name: null, mtfcc: 'S1400', routeType: null },
      geometry: { type: 'LineString', coordinates: [[2, 0], [3, 0]] },
    },
  ];
  return buildRoadGraph(normalizeRoadSourceFeatures(features));
}
describe('GRID named road corridors', () => {
  it('keeps disconnected pieces of the same named road as separate corridors', () => {
    const graph = fixtureGraph();
    const index = buildRoadCorridorIndex(graph);
    expect(index.corridors).toHaveLength(2);
    expect(index.corridors.every((corridor) => corridor.name === 'A St')).toBe(true);
    expect(index.corridors.map((corridor) => corridor.edgeIds.length).sort()).toEqual([1, 2]);
    expect(Object.keys(index.corridorByEdge)).toHaveLength(3);
    const unnamed = graph.edges.find((edge) => edge.name === null)!;
    expect(index.corridorByEdge[unnamed.id]).toBeUndefined();
  });

  it('builds deterministic real Canton named corridors with one corridor per named edge', () => {
    const graph = buildRoadGraph(
      normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures()),
    );
    const first = buildRoadCorridorIndex(graph);
    const second = buildRoadCorridorIndex(graph);
    expect(second).toEqual(first);

    const namedEdges = graph.edges.filter((edge) => edge.name?.trim());
    expect(Object.keys(first.corridorByEdge)).toHaveLength(namedEdges.length);
    expect(namedEdges).toHaveLength(20427);
    expect(first.corridors).toHaveLength(2116);
    const byClass = first.corridors.reduce(
      (counts, corridor) => {
        counts[corridor.roadClass] += 1;
        return counts;
      },
      { primary: 0, secondary: 0, local: 0 },
    );
    expect(byClass).toEqual({ primary: 16, secondary: 56, local: 2044 });
    expect(first.corridors.every((corridor) => corridor.edgeIds.length > 0)).toBe(true);
    expect(first.corridors.every((corridor) => corridor.totalLengthMillimeters > 0)).toBe(true);
  });
});
