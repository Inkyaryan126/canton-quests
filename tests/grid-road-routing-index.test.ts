import { describe, expect, it } from 'vitest';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { buildRoadNetwork } from '../lib/grid/roads/network';
import {
  shortestRoadRoute,
  shortestRoadRouteIndexed,
} from '../lib/grid/roads/routing';

const network = buildRoadNetwork(loadCantonRoadSourceFeatures(), {
  cellSizeDegrees: 0.002,
});

describe('GRID road routing index', () => {
  it('precomputes deterministic bidirectional adjacency and component membership', () => {
    const first = network.routingIndex;
    const second = buildRoadNetwork(loadCantonRoadSourceFeatures(), {
      cellSizeDegrees: 0.002,
    }).routingIndex;
    expect(second).toEqual(first);
    expect(Object.keys(first.adjacency)).toHaveLength(network.graph.nodes.length);
    expect(Object.keys(first.componentByNode)).toHaveLength(network.graph.nodes.length);

    const arcCount = Object.values(first.adjacency).reduce(
      (total, arcs) => total + arcs.length,
      0,
    );
    expect(arcCount).toBe(network.graph.edges.length * 2);
  });
  it('matches legacy shortest-path results across real Canton routes', () => {
    const component = network.graph.components[0];
    const pairs = [
      [component.nodeIds[10], component.nodeIds[500]],
      [component.nodeIds[1000], component.nodeIds[5000]],
      [component.nodeIds[2000], component.nodeIds[12000]],
      [component.nodeIds[4000], component.nodeIds[16000]],
    ] as const;

    for (const [from, to] of pairs) {
      const legacy = shortestRoadRoute(network.graph, from, to);
      const indexed = shortestRoadRouteIndexed(
        network.graph,
        network.routingIndex,
        from,
        to,
      );
      expect(indexed).toEqual(legacy);
    }
  });

  it('rejects disconnected components without producing a route', () => {
    const from = network.graph.components[0].nodeIds[0];
    const to = network.graph.components[1].nodeIds[0];
    expect(
      shortestRoadRouteIndexed(network.graph, network.routingIndex, from, to),
    ).toBeNull();
  });
});
