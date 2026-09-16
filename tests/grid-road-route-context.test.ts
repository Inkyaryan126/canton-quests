import { describe, expect, it } from 'vitest';
import { buildRoadNetwork } from '../lib/grid/roads/network';
import { buildRoadRouteContext } from '../lib/grid/roads/route-context';
import { shortestRoadRoute } from '../lib/grid/roads/routing';
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

function fixtureFeatures(): GridRoadSourceFeature[] {
  return [
    {
      roadClass: 'local',
      properties: { oid: 'a', name: 'A St', mtfcc: 'S1400', routeType: 'M' },
      geometry: { type: 'LineString', coordinates: [[0.2, 0.5], [0.8, 0.5], [1.1, 0.5]] },
    },
    {
      roadClass: 'secondary',
      properties: { oid: 'b', name: 'B Ave', mtfcc: 'S1200', routeType: 'S' },
      geometry: { type: 'LineString', coordinates: [[1.1, 0.5], [1.8, 0.5]] },
    },
  ];
}
describe('GRID road network bundle and route context', () => {
  it('assembles segments, graph, spatial index, and optional territory index deterministically', () => {
    const options = {
      cellSizeDegrees: 0.25,
      territories: [square('west', 0, 1), square('east', 1, 2)],
    };
    const first = buildRoadNetwork(fixtureFeatures(), options);
    const second = buildRoadNetwork(fixtureFeatures(), options);
    expect(second).toEqual(first);
    expect(first.segments).toHaveLength(2);
    expect(first.graph.nodes).toHaveLength(4);
    expect(first.graph.edges).toHaveLength(3);
    expect(first.territoryIndex).toBeDefined();
    expect(Object.keys(first.spatialIndex.cells).length).toBeGreaterThan(0);
  });

  it('summarizes ordered named-road and territory transitions for a route', () => {
    const network = buildRoadNetwork(fixtureFeatures(), {
      cellSizeDegrees: 0.25,
      territories: [square('west', 0, 1), square('east', 1, 2)],
    });
    const from = network.graph.nodes.find((node) => node.lng === 0.2)!.id;
    const to = network.graph.nodes.find((node) => node.lng === 1.8)!.id;
    const route = shortestRoadRoute(network.graph, from, to)!;
    const context = buildRoadRouteContext(network.graph, route, network.territoryIndex);

    expect(context.roadSteps).toEqual([
      { edgeIndex: 0, roadClass: 'local', name: 'A St' },
      { edgeIndex: 2, roadClass: 'secondary', name: 'B Ave' },
    ]);
    expect(context.territorySteps).toEqual([
      { edgeIndex: 0, territorySlugs: ['west'] },
      { edgeIndex: 2, territorySlugs: ['east'] },
    ]);
    expect(context.unassignedEdgeCount).toBe(0);
  });
});
