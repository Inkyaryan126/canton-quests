import { describe, expect, it } from 'vitest';
import { buildCantonRoadRuntime } from '../lib/grid/cities/canton/roads/runtime';
import { roadAccessDistance } from '../lib/grid/roads/distance-matrix';
import { verifyRoadNetworkSnapshot } from '../lib/grid/roads/snapshot';

describe('GRID Canton road runtime', () => {
  it('assembles the complete real Canton routing foundation', () => {
    const runtime = buildCantonRoadRuntime();
    expect(runtime.network.segments).toHaveLength(3456);
    expect(runtime.network.graph.nodes).toHaveLength(17786);
    expect(runtime.network.graph.edges).toHaveLength(22580);
    expect(runtime.network.graph.components).toHaveLength(80);
    expect(Object.keys(runtime.network.territoryIndex?.territoryNodeIds ?? {})).toHaveLength(20);
    expect(runtime.accessIndex.records).toHaveLength(17);
    expect(runtime.accessIndex.resolvedTargetIds).toHaveLength(17);
    expect(runtime.accessIndex.unresolvedTargetIds).toEqual([]);
    expect(runtime.distanceMatrix.targetIds).toHaveLength(17);
    expect(verifyRoadNetworkSnapshot(runtime.snapshot).ok).toBe(true);
  });

  it('is deterministic across independent runtime builds', () => {
    const first = buildCantonRoadRuntime();
    const second = buildCantonRoadRuntime();
    expect(second.snapshot.checksum).toBe(first.snapshot.checksum);
    expect(second.accessIndex).toEqual(first.accessIndex);
    expect(second.distanceMatrix).toEqual(first.distanceMatrix);
  });
  it('keeps the game-place distance matrix symmetric with zero self-distance', () => {
    const runtime = buildCantonRoadRuntime();
    let connectedPairs = 0;
    for (const from of runtime.distanceMatrix.targetIds) {
      expect(roadAccessDistance(runtime.distanceMatrix, from, from)).toBe(0);
      for (const to of runtime.distanceMatrix.targetIds) {
        const forward = roadAccessDistance(runtime.distanceMatrix, from, to);
        const reverse = roadAccessDistance(runtime.distanceMatrix, to, from);
        expect(forward).toBe(reverse);
        if (from !== to && forward !== null) connectedPairs += 1;
      }
    }
    expect(connectedPairs).toBeGreaterThan(0);
  });
});
