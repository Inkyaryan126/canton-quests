import { describe, expect, it } from 'vitest';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { buildRoadGraph } from '../lib/grid/roads/graph';
import { normalizeRoadSourceFeatures } from '../lib/grid/roads/normalize';
import { shortestRoadRoute } from '../lib/grid/roads/routing';
import { validateRoadGraph } from '../lib/grid/roads/validate';
import type { GridRoadSourceFeature } from '../lib/grid/roads/types';

function tinyGraph() {
  const input: GridRoadSourceFeature[] = [
    {
      roadClass: 'local',
      properties: { oid: 'a', name: 'A St', mtfcc: 'S1400', routeType: 'M' },
      geometry: { type: 'LineString', coordinates: [[0, 0], [0, 0.001], [0.001, 0.001]] },
    },
    {
      roadClass: 'secondary',
      properties: { oid: 'b', name: 'B Ave', mtfcc: 'S1200', routeType: 'S' },
      geometry: { type: 'LineString', coordinates: [[0, 0.001], [-0.001, 0.001]] },
    },
  ];
  return buildRoadGraph(normalizeRoadSourceFeatures(input));
}

describe('GRID road graph', () => {
  it('builds stable nodes, edges, components, and positive integer lengths', () => {
    const first = tinyGraph();
    const second = tinyGraph();
    expect(second).toEqual(first);
    expect(first.nodes).toHaveLength(4);
    expect(first.edges).toHaveLength(3);
    expect(first.components).toHaveLength(1);
    expect(first.edges.every((edge) => Number.isSafeInteger(edge.lengthMillimeters) && edge.lengthMillimeters > 0)).toBe(true);
    expect(validateRoadGraph(first)).toEqual([]);
  });
  it('routes deterministically through the shortest connected path', () => {
    const graph = tinyGraph();
    const from = graph.nodes.find((node) => node.lng === -0.001)!.id;
    const to = graph.nodes.find((node) => node.lng === 0.001)!.id;
    const first = shortestRoadRoute(graph, from, to);
    const second = shortestRoadRoute(graph, from, to);
    expect(first).toEqual(second);
    expect(first).not.toBeNull();
    expect(first?.edgeIds).toHaveLength(2);
    expect(first?.nodeIds).toHaveLength(3);
    expect(first?.totalLengthMillimeters).toBeGreaterThan(0);
  });

  it('builds the real Canton road graph with stable measured topology', () => {
    const segments = normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures());
    const graph = buildRoadGraph(segments);
    expect(graph.nodes).toHaveLength(17786);
    expect(graph.edges).toHaveLength(22580);
    expect(graph.components).toHaveLength(80);
    expect(graph.components[0].nodeIds).toHaveLength(16732);
    expect(validateRoadGraph(graph)).toEqual([]);

    const edgeCounts = graph.edges.reduce(
      (counts, edge) => { counts[edge.roadClass] += 1; return counts; },
      { primary: 0, secondary: 0, local: 0 },
    );
    expect(edgeCounts).toEqual({ primary: 1412, secondary: 1465, local: 19703 });
  });
  it('routes across the largest real Canton component and rejects disconnected routes', () => {
    const graph = buildRoadGraph(normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures()));
    const largest = graph.components[0];
    const from = largest.nodeIds[0];
    const to = largest.nodeIds[largest.nodeIds.length - 1];
    const first = shortestRoadRoute(graph, from, to);
    const second = shortestRoadRoute(graph, from, to);
    expect(first).toEqual(second);
    expect(first).not.toBeNull();
    expect(first!.totalLengthMillimeters).toBeGreaterThan(0);
    expect(first!.nodeIds[0]).toBe(from);
    expect(first!.nodeIds.at(-1)).toBe(to);

    const other = graph.components[1].nodeIds[0];
    expect(shortestRoadRoute(graph, from, other)).toBeNull();
  });
});
