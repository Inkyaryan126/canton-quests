import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { buildGridMapLabelPlan } from '../lib/grid/map/labels';
import { buildGridMapRenderPacket } from '../lib/grid/map/render-packet';
import { buildGridMapScene } from '../lib/grid/map/scene';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

function projection() {
  return buildGridWorldProjection(cantonFoundingSeasonPackage);
}

describe('Grid map label planning', () => {
  it('uses district labels at city zoom to keep the city readable', () => {
    const packet = buildGridMapRenderPacket(
      buildGridMapScene(projection(), { zoom: 9 }),
    );
    const labels = buildGridMapLabelPlan(packet);

    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => label.kind === 'district')).toBe(true);
    expect(labels.every((label) => Number.isFinite(label.anchor.lat))).toBe(true);
    expect(labels.every((label) => Number.isFinite(label.anchor.lng))).toBe(true);
  });
  it('uses territory labels at district zoom instead of district labels', () => {
    const world = projection();
    const districtSlug = world.territories[0].districtSlug;
    const packet = buildGridMapRenderPacket(
      buildGridMapScene(world, { zoom: 12, focusDistrictSlug: districtSlug }),
    );
    const labels = buildGridMapLabelPlan(packet);

    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => label.kind === 'territory')).toBe(true);
    expect(labels.some((label) => label.text.length > 0)).toBe(true);
  });

  it('uses safe property names at property zoom', () => {
    const world = projection();
    const property = world.properties.find((candidate) =>
      candidate.point || candidate.geometry,
    );
    expect(property).toBeDefined();

    const packet = buildGridMapRenderPacket(
      buildGridMapScene(world, {
        zoom: 16,
        focusPropertySlug: property!.slug,
      }),
    );
    const labels = buildGridMapLabelPlan(packet);

    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => label.kind === 'property')).toBe(true);
    expect(labels.find((label) => label.slug === property!.slug)?.text)
      .toBe(property!.name);
  });
  it('prioritizes focused and contested geography before ordinary labels', () => {
    const world = projection();
    const districtSlug = world.territories[0].districtSlug;
    const territorySlug = world.territories.find(
      (territory) => territory.districtSlug === districtSlug,
    )!.slug;
    const packet = buildGridMapRenderPacket(
      buildGridMapScene(world, {
        zoom: 12,
        focusTerritorySlug: territorySlug,
      }),
    );
    const focused = packet.territories.features.find(
      (feature) => feature.properties.slug === territorySlug,
    );
    expect(focused).toBeDefined();
    focused!.properties.contested = true;
    focused!.properties.pulse = true;

    const labels = buildGridMapLabelPlan(packet);
    expect(labels[0]).toMatchObject({
      kind: 'territory',
      slug: territorySlug,
      focused: true,
    });
  });

  it('supports a deterministic label budget for crowded scenes', () => {
    const world = projection();
    const districtSlug = world.territories[0].districtSlug;
    const packet = buildGridMapRenderPacket(
      buildGridMapScene(world, { zoom: 12, focusDistrictSlug: districtSlug }),
    );

    const first = buildGridMapLabelPlan(packet, { maxLabels: 3 });
    const second = buildGridMapLabelPlan(packet, { maxLabels: 3 });

    expect(first).toEqual(second);
    expect(first).toHaveLength(Math.min(3, packet.territories.features.length));
    expect(first.map((label) => label.priority))
      .toEqual([...first.map((label) => label.priority)].sort((a, b) => b - a));
  });
});
