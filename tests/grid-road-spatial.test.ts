import { describe, expect, it } from 'vitest';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { buildRoadGraph } from '../lib/grid/roads/graph';
import { normalizeRoadSourceFeatures } from '../lib/grid/roads/normalize';
import { shortestRoadRouteBetweenPoints } from '../lib/grid/roads/routing';
import { buildRoadSpatialIndex, findNearestRoadNode } from '../lib/grid/roads/spatial';

const cantonGraph = buildRoadGraph(
  normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures()),
);

describe('GRID road spatial lookup', () => {
  it('builds a deterministic spatial index for the real Canton road graph', () => {
    const first = buildRoadSpatialIndex(cantonGraph, 0.002);
    const second = buildRoadSpatialIndex(cantonGraph, 0.002);
    expect(second).toEqual(first);
    expect(Object.keys(first.cells).length).toBeGreaterThan(100);
    expect(Object.values(first.cells).flat()).toHaveLength(cantonGraph.nodes.length);
  });

  it('snaps exact and nearby points to the same real road node', () => {
    const index = buildRoadSpatialIndex(cantonGraph, 0.002);
    const target = cantonGraph.nodes[Math.floor(cantonGraph.nodes.length / 2)];
    const exact = findNearestRoadNode(cantonGraph, index, target, 1);
    expect(exact?.nodeId).toBe(target.id);
    expect(exact?.distanceMillimeters).toBe(0);

    const nearby = findNearestRoadNode(
      cantonGraph,
      index,
      { lng: target.lng + 0.0000001, lat: target.lat + 0.0000001 },
      1,
    );
    expect(nearby?.nodeId).toBe(target.id);
  });
  it('returns null when no road node is inside the allowed snap radius', () => {
    const index = buildRoadSpatialIndex(cantonGraph, 0.002);
    expect(findNearestRoadNode(cantonGraph, index, { lng: 0, lat: 0 }, 50)).toBeNull();
  });

  it('routes between GPS-like points after deterministic road snapping', () => {
    const index = buildRoadSpatialIndex(cantonGraph, 0.002);
    const component = cantonGraph.components[0];
    const byId = new Map(cantonGraph.nodes.map((node) => [node.id, node]));
    const from = byId.get(component.nodeIds[100])!;
    const to = byId.get(component.nodeIds[component.nodeIds.length - 100])!;

    const first = shortestRoadRouteBetweenPoints(cantonGraph, index, from, to, 1);
    const second = shortestRoadRouteBetweenPoints(cantonGraph, index, from, to, 1);
    expect(second).toEqual(first);
    expect(first).not.toBeNull();
    expect(first?.fromSnap.distanceMillimeters).toBe(0);
    expect(first?.toSnap.distanceMillimeters).toBe(0);
    expect(first?.route.totalLengthMillimeters).toBeGreaterThan(0);
  });
});
