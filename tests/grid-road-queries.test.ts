import { describe, expect, it } from 'vitest';
import { buildCantonRoadRuntime } from '../lib/grid/cities/canton/roads/runtime';
import { roadAccessDistance } from '../lib/grid/roads/distance-matrix';
import {
  rankReachableRoadAccessTargetsFromTarget,
} from '../lib/grid/roads/queries';

const runtime = buildCantonRoadRuntime();
const sourceTargetId = runtime.accessIndex.resolvedTargetIds[0];

describe('GRID road access ranking queries', () => {
  it('ranks reachable game places deterministically by routed road distance', () => {
    const first = rankReachableRoadAccessTargetsFromTarget(
      runtime.accessIndex,
      runtime.network.routingIndex,
      sourceTargetId,
    );
    const second = rankReachableRoadAccessTargetsFromTarget(
      runtime.accessIndex,
      runtime.network.routingIndex,
      sourceTargetId,
    );
    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((candidate) => candidate.targetId !== sourceTargetId)).toBe(true);

    for (let index = 1; index < first.length; index += 1) {
      const previous = first[index - 1];
      const current = first[index];
      expect(current.distanceMillimeters).toBeGreaterThanOrEqual(previous.distanceMillimeters);
      if (current.distanceMillimeters === previous.distanceMillimeters) {
        expect(current.targetId.localeCompare(previous.targetId)).toBeGreaterThan(0);
      }
    }
  });
  it('matches the precomputed travel matrix for every ranked candidate', () => {
    const ranked = rankReachableRoadAccessTargetsFromTarget(
      runtime.accessIndex,
      runtime.network.routingIndex,
      sourceTargetId,
    );
    for (const candidate of ranked) {
      expect(candidate.distanceMillimeters).toBe(
        roadAccessDistance(runtime.distanceMatrix, sourceTargetId, candidate.targetId),
      );
    }
  });

  it('supports kind filtering and deterministic result limits', () => {
    const landmarks = rankReachableRoadAccessTargetsFromTarget(
      runtime.accessIndex,
      runtime.network.routingIndex,
      sourceTargetId,
      { kinds: ['landmark'], limit: 3 },
    );
    expect(landmarks.length).toBeLessThanOrEqual(3);
    expect(landmarks.every((candidate) => candidate.kind === 'landmark')).toBe(true);

    const properties = rankReachableRoadAccessTargetsFromTarget(
      runtime.accessIndex,
      runtime.network.routingIndex,
      sourceTargetId,
      { kinds: ['property'], limit: 4 },
    );
    expect(properties.length).toBeLessThanOrEqual(4);
    expect(properties.every((candidate) => candidate.kind === 'property')).toBe(true);
  });

  it('returns an empty result for a missing source target', () => {
    expect(
      rankReachableRoadAccessTargetsFromTarget(
        runtime.accessIndex,
        runtime.network.routingIndex,
        'missing:target',
      ),
    ).toEqual([]);
  });
});
