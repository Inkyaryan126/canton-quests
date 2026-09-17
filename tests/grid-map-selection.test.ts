import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { buildGridMapRenderPacket } from '../lib/grid/map/render-packet';
import { buildGridMapScene } from '../lib/grid/map/scene';
import { resolveGridMapSelection } from '../lib/grid/map/selection';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

function packetAt(zoom: number, focus: {
  focusDistrictSlug?: string;
  focusTerritorySlug?: string;
  focusPropertySlug?: string;
} = {}) {
  const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
  return buildGridMapRenderPacket(buildGridMapScene(projection, {
    zoom,
    ...focus,
  }));
}

describe('Grid map selection details', () => {
  it('resolves a city-level district target to safe control summary details', () => {
    const packet = packetAt(9);
    const target = packet.interactionTargets.find((row) => row.kind === 'district');
    expect(target).toBeDefined();

    const selected = resolveGridMapSelection(packet, target!);
    expect(selected).toMatchObject({
      kind: 'district',
      slug: target!.slug,
      territoryCount: expect.any(Number),
      controlRole: expect.stringMatching(/neutral|you|rival|mixed|contested/),
    });
    expect(JSON.stringify(selected)).not.toContain('ownerPlayerId');
  });

  it('resolves a territory target with claim, contest, and development summary', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const territory = projection.territories[0];
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, {
      zoom: 12,
      focusDistrictSlug: territory.districtSlug,
    }));
    const target = packet.interactionTargets.find(
      (row) => row.kind === 'territory' && row.slug === territory.slug,
    );
    expect(target).toBeDefined();

    expect(resolveGridMapSelection(packet, target!)).toMatchObject({
      kind: 'territory',
      slug: territory.slug,
      name: territory.name,
      claimable: false,
      contested: false,
      propertyCount: expect.any(Number),
      developedPropertyCount: expect.any(Number),
      totalDevelopmentLevel: expect.any(Number),
    });
  });

  it('resolves a property target to development and condition details', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const property = projection.properties[0];
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, {
      zoom: 16,
      focusPropertySlug: property.slug,
    }));
    const target = packet.interactionTargets.find(
      (row) => row.kind === 'property' && row.slug === property.slug,
    );
    expect(target).toBeDefined();

    expect(resolveGridMapSelection(packet, target!)).toMatchObject({
      kind: 'property',
      slug: property.slug,
      name: property.name,
      territorySlug: property.territorySlug,
      developmentLevel: 0,
      conditionBand: 'healthy',
      heightUnits: 0,
    });
  });

  it('returns null when a target is not present in the current render packet', () => {
    const packet = packetAt(9);
    expect(resolveGridMapSelection(packet, {
      kind: 'territory',
      slug: 'not-visible',
      districtSlug: 'downtown',
      territorySlug: 'not-visible',
      propertySlug: null,
    })).toBeNull();
  });
});
