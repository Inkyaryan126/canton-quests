import { describe, expect, it } from 'vitest';
import { buildCantonRoadTerritoryIndex } from '../lib/grid/cities/canton/roads/territory-index';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { buildRoadGraph } from '../lib/grid/roads/graph';
import { normalizeRoadSourceFeatures } from '../lib/grid/roads/normalize';
import { buildRoadTerritoryIndex } from '../lib/grid/roads/territories';
import type { GridRoadSourceFeature, GridRoadTerritoryDefinition } from '../lib/grid/roads/types';

function square(slug: string, minLng: number, maxLng: number): GridRoadTerritoryDefinition {
  return {
    slug,
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[[[minLng, 0], [maxLng, 0], [maxLng, 1], [minLng, 1], [minLng, 0]]]],
    },
  };
}

function crossingGraph() {
  const feature: GridRoadSourceFeature = {
    roadClass: 'local',
    properties: { oid: 'crossing', name: 'Boundary Road', mtfcc: 'S1400', routeType: null },
    geometry: { type: 'LineString', coordinates: [[0.5, 0.5], [1, 0.5], [1.5, 0.5]] },
  };
  return buildRoadGraph(normalizeRoadSourceFeatures([feature]));
}
describe('GRID road territory indexing', () => {
  it('keeps shared-boundary nodes explicitly assigned to both touching territories', () => {
    const graph = crossingGraph();
    const index = buildRoadTerritoryIndex(graph, [square('a', 0, 1), square('b', 1, 2)]);
    const boundaryNode = graph.nodes.find((node) => node.lng === 1)!;
    expect(index.nodeTerritories[boundaryNode.id]).toEqual(['a', 'b']);
    expect(index.territoryNodeIds.a).toContain(boundaryNode.id);
    expect(index.territoryNodeIds.b).toContain(boundaryNode.id);
    expect(index.unassignedNodeIds).toEqual([]);
    expect(index.unassignedEdgeIds).toEqual([]);
  });

  it('maps edge midpoints to the territory actually traversed', () => {
    const graph = crossingGraph();
    const index = buildRoadTerritoryIndex(graph, [square('a', 0, 1), square('b', 1, 2)]);
    const edgeTerritories = graph.edges.map((edge) => index.edgeTerritories[edge.id]);
    expect(edgeTerritories).toEqual([['a'], ['b']]);
  });
  it('indexes the real Canton road graph against the 20 compiled downtown territories deterministically', () => {
    const graph = buildRoadGraph(normalizeRoadSourceFeatures(loadCantonRoadSourceFeatures()));
    const first = buildCantonRoadTerritoryIndex(graph);
    const second = buildCantonRoadTerritoryIndex(graph);
    expect(second).toEqual(first);
    expect(Object.keys(first.territoryNodeIds)).toHaveLength(20);
    expect(Object.keys(first.territoryEdgeIds)).toHaveLength(20);

    const assignedNodes = graph.nodes.length - first.unassignedNodeIds.length;
    const assignedEdges = graph.edges.length - first.unassignedEdgeIds.length;
    expect(assignedNodes).toBeGreaterThan(0);
    expect(assignedEdges).toBeGreaterThan(0);
    expect(first.unassignedNodeIds.length).toBeGreaterThan(0);
    expect(first.unassignedEdgeIds.length).toBeGreaterThan(0);

    const populatedTerritories = Object.values(first.territoryNodeIds).filter((ids) => ids.length > 0);
    expect(populatedTerritories.length).toBeGreaterThan(10);
  });
});
