import { describe, expect, it } from 'vitest';
import { buildCantonRoadAccessIndex } from '../lib/grid/cities/canton/roads/access';
import { buildCantonRoadTerritoryIndex } from '../lib/grid/cities/canton/roads/territory-index';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { buildRoadAccessJourney } from '../lib/grid/roads/journeys';
import { buildRoadNetwork } from '../lib/grid/roads/network';

const network = buildRoadNetwork(loadCantonRoadSourceFeatures(), {
  cellSizeDegrees: 0.002,
});
const accessIndex = buildCantonRoadAccessIndex(
  network.graph,
  network.spatialIndex,
  250,
);
const territoryIndex = buildCantonRoadTerritoryIndex(network.graph);

function connectedTargetPair(): [string, string] {
  const componentByNode = new Map<string, string>();
  for (const component of network.graph.components) {
    for (const nodeId of component.nodeIds) componentByNode.set(nodeId, component.id);
  }

  const resolved = accessIndex.records.filter((record) => record.snap);
  for (let i = 0; i < resolved.length; i += 1) {
    for (let j = i + 1; j < resolved.length; j += 1) {
      const a = resolved[i].snap!;
      const b = resolved[j].snap!;
      if (a.nodeId !== b.nodeId && componentByNode.get(a.nodeId) === componentByNode.get(b.nodeId)) {
        return [resolved[i].targetId, resolved[j].targetId];
      }
    }
  }
  throw new Error('expected at least two connected Canton road access targets');
}
describe('GRID road access journeys', () => {
  it('routes deterministically between two connected real Canton game places', () => {
    const [fromTargetId, toTargetId] = connectedTargetPair();
    const first = buildRoadAccessJourney(
      network.graph,
      accessIndex,
      fromTargetId,
      toTargetId,
      territoryIndex,
    );
    const second = buildRoadAccessJourney(
      network.graph,
      accessIndex,
      fromTargetId,
      toTargetId,
      territoryIndex,
    );

    expect(second).toEqual(first);
    expect(first).not.toBeNull();
    expect(first?.route.totalLengthMillimeters).toBeGreaterThan(0);
    expect(first?.route.edgeIds.length).toBeGreaterThan(0);
    expect(first?.context.roadSteps.length).toBeGreaterThan(0);
    expect(first?.context.territorySteps.length).toBeGreaterThan(0);
  });

  it('returns null for missing or unresolved access targets', () => {
    const existing = accessIndex.records[0].targetId;
    expect(
      buildRoadAccessJourney(network.graph, accessIndex, existing, 'missing:target', territoryIndex),
    ).toBeNull();
  });
});
