import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { buildGridMapRenderPacket } from '../lib/grid/map/render-packet';
import { buildGridMapScene } from '../lib/grid/map/scene';
import { filterGridMapRenderPacketToViewport } from '../lib/grid/map';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

describe('Grid map viewport filtering', () => {
  it('rejects inverted viewport bounds', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(
      buildGridMapScene(projection, { zoom: 12 }),
    );

    expect(() =>
      filterGridMapRenderPacketToViewport(packet, {
        west: -81.36,
        south: 40.81,
        east: -81.38,
        north: 40.79,
      }),
    ).toThrow(/viewport bounds/i);
  });
});

describe('Grid map viewport geometry culling', () => {
  it('removes offscreen geometry while retaining district summaries', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(
      buildGridMapScene(projection, { zoom: 12 }),
    );
    expect(packet.territories.features.length).toBeGreaterThan(0);

    const filtered = filterGridMapRenderPacketToViewport(packet, {
      west: 0,
      south: 0,
      east: 1,
      north: 1,
    });

    expect(filtered.districtSummaries).toEqual(packet.districtSummaries);
    expect(filtered.districts.features).toEqual([]);
    expect(filtered.territories.features).toEqual([]);
    expect(filtered.properties.features).toEqual([]);
    expect(filtered.contestFronts.features).toEqual([]);
    expect(filtered.virtualBuildings).toEqual([]);
    expect(filtered.interactionTargets).toEqual([]);
  });
});
