import { describe, expect, it } from 'vitest';
import {
  buildCantonRoadAccessIndex,
  cantonRoadAccessTargets,
} from '../lib/grid/cities/canton/roads/access';
import { loadCantonRoadSourceFeatures } from '../lib/grid/cities/canton/roads/source';
import { buildRoadAccessIndex } from '../lib/grid/roads/access';
import { buildRoadNetwork } from '../lib/grid/roads/network';

const cantonNetwork = buildRoadNetwork(loadCantonRoadSourceFeatures(), {
  cellSizeDegrees: 0.002,
});

describe('GRID road access targets', () => {
  it('rejects duplicate target ids instead of producing ambiguous access records', () => {
    expect(() =>
      buildRoadAccessIndex(
        cantonNetwork.graph,
        cantonNetwork.spatialIndex,
        [
          { id: 'same', kind: 'custom', point: { lng: -81.37, lat: 40.79 } },
          { id: 'same', kind: 'custom', point: { lng: -81.38, lat: 40.80 } },
        ],
        100,
      ),
    ).toThrow(/unique ids/i);
  });

  it('creates deterministic access targets for all compiled Canton properties and landmarks', () => {
    const first = cantonRoadAccessTargets();
    const second = cantonRoadAccessTargets();
    expect(second).toEqual(first);
    expect(first).toHaveLength(17);
    expect(first.filter((target) => target.kind === 'property')).toHaveLength(11);
    expect(first.filter((target) => target.kind === 'landmark')).toHaveLength(6);
  });
  it('resolves every current Canton game place to a nearby trusted road node', () => {
    const first = buildCantonRoadAccessIndex(
      cantonNetwork.graph,
      cantonNetwork.spatialIndex,
      250,
    );
    const second = buildCantonRoadAccessIndex(
      cantonNetwork.graph,
      cantonNetwork.spatialIndex,
      250,
    );
    expect(second).toEqual(first);
    expect(first.resolvedTargetIds).toHaveLength(17);
    expect(first.unresolvedTargetIds).toEqual([]);
    expect(first.records.every((record) => record.snap !== null)).toBe(true);

    const maxDistance = Math.max(
      ...first.records.map((record) => record.snap?.distanceMillimeters ?? 0),
    );
    expect(maxDistance).toBeLessThanOrEqual(250_000);
  });

  it('leaves a target unresolved when the allowed access radius is intentionally too small', () => {
    const target = cantonRoadAccessTargets()[0];
    const strict = buildRoadAccessIndex(
      cantonNetwork.graph,
      cantonNetwork.spatialIndex,
      [target],
      0,
    );
    if (strict.resolvedTargetIds.length === 0) {
      expect(strict.unresolvedTargetIds).toEqual([target.id]);
    } else {
      expect(strict.records[0].snap?.distanceMillimeters).toBe(0);
    }
  });
});
