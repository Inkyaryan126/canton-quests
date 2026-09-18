import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { diffGridMapRenderPackets } from '../lib/grid/map/delta';
import {
  buildGridMapRenderPacket,
  type GridMapRenderPacket,
} from '../lib/grid/map/render-packet';
import { buildGridMapScene } from '../lib/grid/map/scene';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

function districtPacket(): GridMapRenderPacket {
  const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
  const districtSlug = projection.territories[0].districtSlug;
  return buildGridMapRenderPacket(buildGridMapScene(projection, {
    zoom: 12,
    focusDistrictSlug: districtSlug,
  }));
}

function clonePacket(packet: GridMapRenderPacket): GridMapRenderPacket {
  return JSON.parse(JSON.stringify(packet)) as GridMapRenderPacket;
}

describe('Grid map render deltas', () => {
  it('reports no work for byte-equivalent packets', () => {
    const packet = districtPacket();
    const delta = diffGridMapRenderPackets(packet, clonePacket(packet));
    expect(delta.cameraChanged).toBe(false);
    expect(delta.zoomBandChanged).toBe(false);
    expect(delta.skylinesChanged).toBe(false);
    expect(delta.districts).toEqual({ added: [], removed: [], changed: [] });
    expect(delta.territories).toEqual({ added: [], removed: [], changed: [] });
    expect(delta.properties).toEqual({ added: [], removed: [], changed: [] });
    expect(delta.contestFronts).toEqual({ added: [], removed: [], changed: [] });
    expect(delta.virtualBuildings).toEqual({ added: [], removed: [], changed: [] });
  });

  it('detects added, removed, and changed territory features by slug', () => {
    const previous = districtPacket();
    expect(previous.territories.features.length).toBeGreaterThan(1);
    const next = clonePacket(previous);

    const changedSlug = next.territories.features[0].properties.slug;
    next.territories.features[0].properties.glow = 'strong';
    const removed = next.territories.features.pop()!;
    const removedSlug = removed.properties.slug;
    const added = clonePacket(previous).territories.features[0];
    added.properties.slug = 'synthetic-added';
    next.territories.features.push(added);

    expect(diffGridMapRenderPackets(previous, next).territories).toEqual({
      added: ['synthetic-added'],
      removed: [removedSlug],
      changed: [changedSlug],
    });
  });

  it('treats feature ordering as irrelevant', () => {
    const previous = districtPacket();
    const next = clonePacket(previous);
    next.districts.features.reverse();
    next.territories.features.reverse();
    next.properties.features.reverse();
    next.contestFronts.features.reverse();
    next.virtualBuildings.reverse();

    const delta = diffGridMapRenderPackets(previous, next);
    expect(delta.districts).toEqual({ added: [], removed: [], changed: [] });
    expect(delta.territories).toEqual({ added: [], removed: [], changed: [] });
    expect(delta.properties).toEqual({ added: [], removed: [], changed: [] });
    expect(delta.contestFronts).toEqual({ added: [], removed: [], changed: [] });
    expect(delta.virtualBuildings).toEqual({ added: [], removed: [], changed: [] });
  });

  it('separately signals camera and zoom-band transitions', () => {
    const previous = districtPacket();
    const next = clonePacket(previous);
    next.center = { lat: previous.center.lat + 0.01, lng: previous.center.lng };
    next.zoom = 16;
    next.zoomBand = 'property';

    const delta = diffGridMapRenderPackets(previous, next);
    expect(delta.cameraChanged).toBe(true);
    expect(delta.zoomBandChanged).toBe(true);
  });

  it('reports skyline payload changes independently', () => {
    const previous = districtPacket();
    const next = clonePacket(previous);
    next.skylines = [{
      propertySlugs: ['p-1'],
      territorySlugs: ['t-1'],
      totalDevelopmentLevel: 4,
      ruleIds: ['skyline-rule'],
    }];

    expect(diffGridMapRenderPackets(previous, next).skylinesChanged).toBe(true);
  });
});
