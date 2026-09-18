import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import type { GridSurgeConfig } from '../lib/grid/core/surge-types';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

const surgeConfig: GridSurgeConfig = {
  durationMinutes: 72 * 60,
  districtControlValueMultiplierBps: 15_000,
  landmarkValueMultiplierBps: 17_500,
  hotspotValueMultiplierBps: 20_000,
  dominanceExposureMultiplierBps: 12_500,
  hotspotCount: 0,
  maxHotspotsPerDistrict: 0,
  specialObjectiveSlots: 4,
  npcStrongholdSlots: 2,
  emphasizeFinalRankings: true,
  hotspotWeights: { strategicValueBps: 4_000, contestPressureBps: 3_500, underdogOpportunityBps: 2_500 },
};

describe('Grid world Surge gameplay projection', () => {
  it('exposes deterministic read-only Surge effects when the finale is live', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      now: '2026-09-13T12:00:00.000Z',
      surgeConfig,
      runtime: {
        seasonId: 'season-canton-founding-2026',
        seasonStatus: 'surge', startsAt: '2026-09-01T00:00:00.000Z',
        surgeStartsAt: '2026-09-12T00:00:00.000Z', endsAt: '2026-09-15T00:00:00.000Z',
        territories: [], properties: [], playerState: null,
      },
    });

    expect(projection.season.surgeGameplay).toMatchObject({
      active: true, phase: 'surge', progressBps: 5_000,
      effects: { landmarkValueMultiplierBps: 17_500, specialObjectiveSlots: 4, npcStrongholdSlots: 2, emphasizeFinalRankings: true },
    });
  });
});
