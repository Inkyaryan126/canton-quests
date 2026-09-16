import { describe, expect, it } from 'vitest';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { buildRoadGraph } from '../lib/grid/roads/graph';
import { normalizeRoadSourceFeatures } from '../lib/grid/roads/normalize';
import { shortestRoadRoute } from '../lib/grid/roads/routing';
import type { GridRoadSegment } from '../lib/grid/roads/types';

function syntheticSegments(): GridRoadSegment[] {
  return [
    {
      id: 'local:b:0',
      roadClass: 'local',
      sourceOid: 'b',
      sourcePartIndex: 0,
      name: 'B',
      mtfcc: 'S1400',
      routeType: null,
      coordinates: [[0, 0], [0, 0.001], [0.001, 0.001]],
    },
    {
      id: 'primary:a:0',
      roadClass: 'primary',
      sourceOid: 'a',
      sourcePartIndex: 0,
      name: 'A',
      mtfcc: 'S1100',
      routeType: 'I',
      coordinates: [[0, 0.001], [-0.001, 0.001]],
    },
  ];
}

describe('GRID road graph integrity', () => {
  it('is independent of source segment input order', () => {
    const input = syntheticSegments();
    expect(buildRoadGraph([...input].reverse())).toEqual(buildRoadGraph(input));
  });

  it('partitions every graph node and edge into exactly one connected component', () => {
    const graph = buildRoadGraph(
      normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures()),
    );

    const componentNodeIds = graph.components.flatMap((component) => component.nodeIds);
    const componentEdgeIds = graph.components.flatMap((component) => component.edgeIds);

    expect(componentNodeIds).toHaveLength(graph.nodes.length);
    expect(componentEdgeIds).toHaveLength(graph.edges.length);
    expect(new Set(componentNodeIds).size).toBe(graph.nodes.length);
    expect(new Set(componentEdgeIds).size).toBe(graph.edges.length);
    expect([...componentNodeIds].sort()).toEqual(graph.nodes.map((node) => node.id).sort());
    expect([...componentEdgeIds].sort()).toEqual(graph.edges.map((edge) => edge.id).sort());
  });

  it('preserves source-segment lineage for every real Canton graph edge', () => {
    const segments = normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures());
    const graph = buildRoadGraph(segments);
    const byId = new Map(segments.map((segment) => [segment.id, segment]));

    const violations: string[] = [];
    for (const edge of graph.edges) {
      const source = byId.get(edge.sourceSegmentId);
      if (!source) {
        violations.push(`${edge.id}: missing source segment ${edge.sourceSegmentId}`);
        continue;
      }
      if (edge.sourceVertexIndex < 0 || edge.sourceVertexIndex >= source.coordinates.length - 1) {
        violations.push(`${edge.id}: invalid source vertex index ${edge.sourceVertexIndex}`);
      }
      if (edge.roadClass !== source.roadClass) violations.push(`${edge.id}: road class drift`);
      if (edge.name !== source.name) violations.push(`${edge.id}: name drift`);
      if (edge.mtfcc !== source.mtfcc) violations.push(`${edge.id}: MTFCC drift`);
      if (edge.routeType !== source.routeType) violations.push(`${edge.id}: route type drift`);
    }
    expect(violations).toEqual([]);
  });

  it('reconciles a computed route total exactly to its constituent edge lengths', () => {
    const graph = buildRoadGraph(
      normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures()),
    );
    const largest = graph.components[0];
    const route = shortestRoadRoute(
      graph,
      largest.nodeIds[0],
      largest.nodeIds[largest.nodeIds.length - 1],
    );
    expect(route).not.toBeNull();

    const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
    const sum = route!.edgeIds.reduce(
      (total, edgeId) => total + edgeById.get(edgeId)!.lengthMillimeters,
      0,
    );
    expect(sum).toBe(route!.totalLengthMillimeters);
    expect(route!.nodeIds).toHaveLength(route!.edgeIds.length + 1);
  });
});
