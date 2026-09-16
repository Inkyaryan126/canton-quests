import { describe, expect, it } from 'vitest';
import { buildCantonRoadAccessIndex } from '../lib/grid/cities/canton/roads/access';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import {
  buildRoadAccessDistanceMatrix,
  roadAccessDistance,
} from '../lib/grid/roads/distance-matrix';
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

describe('GRID road access distance matrix', () => {
  it('builds a deterministic 17-place Canton travel matrix', () => {
    const first = buildRoadAccessDistanceMatrix(accessIndex, network.routingIndex);
    const second = buildRoadAccessDistanceMatrix(accessIndex, network.routingIndex);
    expect(second).toEqual(first);
    expect(first.targetIds).toHaveLength(17);
    expect(first.targetIds).toEqual(first.targetIds.slice().sort());

    for (const from of first.targetIds) {
      expect(roadAccessDistance(first, from, from)).toBe(0);
      for (const to of first.targetIds) {
        const value = roadAccessDistance(first, from, to);
        expect(value === null || (Number.isSafeInteger(value) && value >= 0)).toBe(true);
        expect(value).toBe(roadAccessDistance(first, to, from));
      }
    }
  });
  it('matches an explicit shortest journey distance for a connected pair', () => {
    const matrix = buildRoadAccessDistanceMatrix(accessIndex, network.routingIndex);
    let pair: [string, string] | null = null;
    for (let i = 0; i < matrix.targetIds.length && !pair; i += 1) {
      for (let j = i + 1; j < matrix.targetIds.length; j += 1) {
        if (roadAccessDistance(matrix, matrix.targetIds[i], matrix.targetIds[j]) !== null) {
          pair = [matrix.targetIds[i], matrix.targetIds[j]];
          break;
        }
      }
    }
    expect(pair).not.toBeNull();
    const journey = buildRoadAccessJourney(
      network.graph,
      accessIndex,
      pair![0],
      pair![1],
    );
    expect(journey).not.toBeNull();
    expect(roadAccessDistance(matrix, pair![0], pair![1])).toBe(
      journey!.route.totalLengthMillimeters,
    );
  });
});
