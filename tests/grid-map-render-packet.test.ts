import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { buildGridMapRenderPacket } from '../lib/grid/map/render-packet';
import { buildGridMapScene } from '../lib/grid/map/scene';
import {
  buildGridWorldProjection,
  type GridWorldRuntimeSnapshot,
} from '../lib/grid/server/world-projection';

function runtime(): GridWorldRuntimeSnapshot {
  return {
    seasonId: 'season-1',
    seasonStatus: 'active',
    territories: [],
    properties: [],
    contests: [],
    playerState: {
      credits: 100,
      influence: 75,
      commandPoints: 8,
      resourcesSettledAt: '2026-09-16T18:00:00.000Z',
    },
  };
}

describe('Grid renderer packet', () => {
  it('converts visible territory scene geometry into semantic GeoJSON features', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const districtSlug = projection.territories[0].districtSlug;
    const scene = buildGridMapScene(projection, {
      zoom: 12,
      focusDistrictSlug: districtSlug,
    });
    const packet = buildGridMapRenderPacket(scene);

    expect(packet.zoomBand).toBe('district');
    expect(packet.territories.type).toBe('FeatureCollection');
    expect(packet.territories.features.length).toBeGreaterThan(0);
    expect(
      packet.territories.features.every(
        (feature) =>
          feature.geometry.type === 'MultiPolygon' &&
          feature.properties.districtSlug === districtSlug,
      ),
    ).toBe(true);
    expect(
      packet.territories.features.every(
        (feature) => !('ownerPlayerId' in feature.properties),
      ),
    ).toBe(true);
  });

  it('emits property points or footprints and renderer-neutral virtual buildings', () => {
    const property = cantonFoundingSeasonPackage.properties.find(
      (candidate) => candidate.geometry || candidate.point,
    );
    expect(property).toBeDefined();

    const territory = cantonFoundingSeasonPackage.territories.find(
      (candidate) => candidate.slug === property!.territorySlug,
    );
    expect(territory).toBeDefined();

    const state = runtime();
    state.territories = [{
      territorySlug: territory!.slug,
      ownerPlayerId: 'viewer-player',
      claimedAt: '2026-09-16T18:01:00.000Z',
    }];
    state.properties = [{
      propertySlug: property!.slug,
      ownerPlayerId: 'viewer-player',
      acquiredAt: '2026-09-16T18:02:00.000Z',
      developmentBranch: 'commerce',
      developmentLevel: 3,
      conditionBps: 7_250,
    }];

    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: 'viewer-player',
      runtime: state,
    });
    const scene = buildGridMapScene(projection, {
      zoom: 16,
      focusPropertySlug: property!.slug,
    });
    const packet = buildGridMapRenderPacket(scene);

    const feature = packet.properties.features.find(
      (candidate) => candidate.properties.slug === property!.slug,
    );
    const building = packet.virtualBuildings.find(
      (candidate) => candidate.propertySlug === property!.slug,
    );

    expect(feature).toBeDefined();
    expect(['Point', 'MultiPolygon']).toContain(feature!.geometry.type);
    expect(feature!.properties).toMatchObject({
      ownership: 'you',
      developmentBranch: 'commerce',
      developmentLevel: 3,
      conditionBand: 'worn',
      virtualBuildingVisible: true,
      heightUnits: 3,
    });
    expect(building).toMatchObject({
      propertySlug: property!.slug,
      territorySlug: property!.territorySlug,
      heightUnits: 3,
      developmentBranch: 'commerce',
      conditionBand: 'worn',
      ownership: 'you',
    });
  });

  it('projects participant contest fronts as GeoJSON lines without opponent identity', () => {
    const edge = cantonFoundingSeasonPackage.edges[0];
    const source = cantonFoundingSeasonPackage.territories.find(
      (territory) => territory.slug === edge.a,
    );
    const target = cantonFoundingSeasonPackage.territories.find(
      (territory) => territory.slug === edge.b,
    );
    expect(source?.geometry).toBeDefined();
    expect(target?.geometry).toBeDefined();

    const state = runtime();
    state.territories = [
      {
        territorySlug: edge.a,
        ownerPlayerId: 'viewer-player',
        claimedAt: '2026-09-16T18:01:00.000Z',
      },
      {
        territorySlug: edge.b,
        ownerPlayerId: 'defender-secret-id',
        claimedAt: '2026-09-16T18:02:00.000Z',
      },
    ];
    state.contests = [{
      contestId: 'contest-1',
      sourceTerritorySlug: edge.a,
      targetTerritorySlug: edge.b,
      attackerPlayerId: 'viewer-player',
      defenderPlayerId: 'defender-secret-id',
      attackerRemainingInfluence: 40,
      defenderRemainingInfluence: 20,
      roundNumber: 3,
      status: 'active',
      startedAt: '2026-09-16T18:03:00.000Z',
    }];

    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: 'viewer-player',
      runtime: state,
    });
    const scene = buildGridMapScene(projection, { zoom: 12 });
    const packet = buildGridMapRenderPacket(scene);

    expect(packet.contestFronts.features).toEqual([
      expect.objectContaining({
        geometry: expect.objectContaining({ type: 'LineString' }),
        properties: {
          contestId: 'contest-1',
          role: 'attacker',
          roundNumber: 3,
        },
      }),
    ]);
    expect(JSON.stringify(packet)).not.toContain('defender-secret-id');
  });

  it('creates deterministic renderer interaction targets', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const property = projection.properties[0];
    const scene = buildGridMapScene(projection, {
      zoom: 16,
      focusPropertySlug: property.slug,
    });

    const packetA = buildGridMapRenderPacket(scene);
    const packetB = buildGridMapRenderPacket({
      ...scene,
      territories: [...scene.territories].reverse(),
      properties: [...scene.properties].reverse(),
    });

    expect(packetA.interactionTargets).toEqual(packetB.interactionTargets);
    expect(packetA.interactionTargets).toContainEqual(
      expect.objectContaining({
        kind: 'property',
        propertySlug: property.slug,
        territorySlug: property.territorySlug,
      }),
    );
  });

  it('keeps city zoom payload deliberately light', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(
      buildGridMapScene(projection, { zoom: 9 }),
    );

    expect(packet.zoomBand).toBe('city');
    expect(packet.territories.features).toEqual([]);
    expect(packet.properties.features).toEqual([]);
    expect(packet.virtualBuildings).toEqual([]);
    expect(packet.interactionTargets).toEqual([]);
    expect(packet.districtSummaries.length).toBeGreaterThan(0);
  });
});
