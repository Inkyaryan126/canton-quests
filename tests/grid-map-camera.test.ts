import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { buildGridMapCameraPlan } from '../lib/grid/map/camera';
import { buildGridMapRenderPacket } from '../lib/grid/map/render-packet';
import { buildGridMapScene } from '../lib/grid/map/scene';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

function packetAt(zoom: number, focusPropertySlug?: string) {
  const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
  return buildGridMapRenderPacket(
    buildGridMapScene(projection, {
      zoom,
      focusPropertySlug,
    }),
  );
}

describe('Grid map camera planning', () => {
  it('fits a clicked city district and prepares district zoom focus', () => {
    const packet = packetAt(9);
    const target = packet.interactionTargets.find(
      (candidate) => candidate.kind === 'district',
    );
    expect(target).toBeDefined();

    const plan = buildGridMapCameraPlan(packet, target!);

    expect(plan.navigation).toEqual({
      zoom: 11,
      focusDistrictSlug: target!.slug,
      focusTerritorySlug: null,
      focusPropertySlug: null,
    });
    expect(plan.fitBounds).not.toBeNull();
    expect(plan.center.lat).toBeGreaterThan(40);
    expect(plan.center.lng).toBeLessThan(-80);
  });

  it('centers directly on a selected point property', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const property = projection.properties.find((candidate) => candidate.point);
    expect(property).toBeDefined();

    const packet = packetAt(16, property!.slug);
    const target = packet.interactionTargets.find(
      (candidate) => candidate.kind === 'property' && candidate.slug === property!.slug,
    );
    expect(target).toBeDefined();

    const plan = buildGridMapCameraPlan(packet, target!);

    expect(plan.navigation.focusPropertySlug).toBe(property!.slug);
    expect(plan.navigation.zoom).toBe(15);
    expect(plan.center).toEqual(property!.point);
    expect(plan.fitBounds).toBeNull();
  });

  it('rejects a target that is not present in the current render packet', () => {
    const packet = packetAt(9);

    expect(() => buildGridMapCameraPlan(packet, {
      kind: 'district',
      slug: 'missing-district',
      districtSlug: 'missing-district',
      territorySlug: null,
      propertySlug: null,
    })).toThrow(/not present/i);
  });

  it('is deterministic for the same packet and target', () => {
    const packet = packetAt(9);
    const target = packet.interactionTargets.find(
      (candidate) => candidate.kind === 'district',
    )!;
    expect(buildGridMapCameraPlan(packet, target))
      .toEqual(buildGridMapCameraPlan(packet, target));
  });
});
