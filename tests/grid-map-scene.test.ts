import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import {
  buildGridMapScene,
  gridMapZoomBand,
} from '../lib/grid/map/scene';
import {
  buildGridWorldProjection,
  type GridWorldRuntimeSnapshot,
} from '../lib/grid/server/world-projection';

function joinedRuntime(): GridWorldRuntimeSnapshot {
  return {
    seasonId: 'season-1',
    seasonStatus: 'active',
    territories: [],
    properties: [],
    playerState: {
      credits: 100,
      influence: 90,
      commandPoints: 7,
      resourcesSettledAt: '2026-09-16T10:00:00.000Z',
    },
  };
}

describe('Grid 2.5D map scene projection', () => {
  it('uses stable city, district, and property zoom bands', () => {
    expect(gridMapZoomBand(0)).toBe('city');
    expect(gridMapZoomBand(10.99)).toBe('city');
    expect(gridMapZoomBand(11)).toBe('district');
    expect(gridMapZoomBand(14.99)).toBe('district');
    expect(gridMapZoomBand(15)).toBe('property');
    expect(() => gridMapZoomBand(-1)).toThrow(/finite non-negative/);
  });
  it('keeps city zoom lightweight while preserving district control summaries', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const scene = buildGridMapScene(projection, { zoom: 9 });

    expect(scene.zoomBand).toBe('city');
    expect(scene.center).toEqual(cantonFoundingSeasonPackage.city.mapCenter);
    expect(scene.visibility.territories).toBe(false);
    expect(scene.visibility.properties).toBe(false);
    expect(scene.territories).toEqual([]);
    expect(scene.properties).toEqual([]);
    expect(scene.districts.length).toBeGreaterThan(0);
    expect(scene.districts.reduce((sum, district) => sum + district.territoryCount, 0))
      .toBe(cantonFoundingSeasonPackage.territories.length);
    expect(scene.districts.every((district) => district.neutralTerritories === district.territoryCount))
      .toBe(true);
  });

  it('reveals only the focused district territory layer at district zoom', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const districtSlug = projection.territories[0].districtSlug;
    const scene = buildGridMapScene(projection, {
      zoom: 12,
      focusDistrictSlug: districtSlug,
    });

    expect(scene.zoomBand).toBe('district');
    expect(scene.visibility.territories).toBe(true);
    expect(scene.visibility.properties).toBe(false);
    expect(scene.territories.length).toBeGreaterThan(0);
    expect(scene.territories.every((territory) => territory.districtSlug === districtSlug))
      .toBe(true);
    expect(scene.districts.find((district) => district.slug === districtSlug)?.focused)
      .toBe(true);
  });
  it('projects property development into renderer-neutral virtual building height', () => {
    const property = cantonFoundingSeasonPackage.properties[0];
    expect(property).toBeDefined();
    const territory = cantonFoundingSeasonPackage.territories.find(
      (candidate) => candidate.slug === property.territorySlug,
    );
    expect(territory).toBeDefined();

    const runtime = joinedRuntime();
    runtime.territories = [{
      territorySlug: territory!.slug,
      ownerPlayerId: 'viewer-player',
      claimedAt: '2026-09-16T10:01:00.000Z',
    }];
    runtime.properties = [{
      propertySlug: property.slug,
      ownerPlayerId: 'viewer-player',
      acquiredAt: '2026-09-16T10:02:00.000Z',
      developmentBranch: 'commerce' as const,
      developmentLevel: 2,
      conditionBps: 7_500,
    }];

    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: 'viewer-player',
      runtime,
    });
    const scene = buildGridMapScene(projection, {
      zoom: 16,
      focusPropertySlug: property.slug,
    });
    const projected = scene.properties.find((candidate) => candidate.slug === property.slug);

    expect(scene.focus).toEqual({
      districtSlug: territory!.districtSlug,
      territorySlug: territory!.slug,
      propertySlug: property.slug,
    });
    expect(scene.visibility.virtualBuildings).toBe(true);
    expect(projected).toMatchObject({
      ownership: 'you',
      developmentBranch: 'commerce',
      developmentLevel: 2,
      heightUnits: 2,
      conditionBps: 7_500,
      damaged: true,
      focused: true,
    });
    expect(scene.territories).toHaveLength(1);
    expect(scene.territories[0]).toMatchObject({
      slug: territory!.slug,
      totalDevelopmentLevel: 2,
      developedPropertyCount: 1,
    });
  });

  it('surfaces contested fronts without leaking opponent identity', () => {
    const edge = cantonFoundingSeasonPackage.edges[0];
    expect(edge).toBeDefined();

    const runtime = joinedRuntime();
    runtime.territories = [
      {
        territorySlug: edge.a,
        ownerPlayerId: 'viewer-player',
        claimedAt: '2026-09-16T10:00:00.000Z',
      },
      {
        territorySlug: edge.b,
        ownerPlayerId: 'defender-secret-id',
        claimedAt: '2026-09-16T10:01:00.000Z',
      },
    ];
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage, {
      viewerPlayerId: 'viewer-player',
      runtime: {
        ...runtime,
        contests: [{
          contestId: 'contest-1',
          sourceTerritorySlug: edge.a,
          targetTerritorySlug: edge.b,
          attackerPlayerId: 'viewer-player',
          defenderPlayerId: 'defender-secret-id',
          attackerRemainingInfluence: 60,
          defenderRemainingInfluence: 30,
          roundNumber: 2,
          status: 'active' as const,
          startedAt: '2026-09-16T10:02:00.000Z',
        }],
      },
    });
    const scene = buildGridMapScene(projection, { zoom: 12 });

    expect(scene.territories.find((territory) => territory.slug === edge.b)?.visualState)
      .toBe('contested');
    expect(scene.contestFronts).toEqual([expect.objectContaining({
      contestId: 'contest-1',
      role: 'attacker',
      sourceTerritorySlug: edge.a,
      targetTerritorySlug: edge.b,
      roundNumber: 2,
    })]);
    expect(JSON.stringify(scene)).not.toContain('defender-secret-id');
  });

  it('is deterministic and rejects contradictory focus paths', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const property = projection.properties[0];
    const territory = projection.territories.find(
      (candidate) => candidate.slug === property.territorySlug,
    )!;
    const options = { zoom: 16, focusPropertySlug: property.slug };
    expect(buildGridMapScene(projection, options))
      .toEqual(buildGridMapScene(projection, options));

    const wrongDistrict = projection.territories.find(
      (candidate) => candidate.districtSlug !== territory.districtSlug,
    )?.districtSlug;

    if (wrongDistrict) {
      expect(() =>
        buildGridMapScene(projection, {
          zoom: 16,
          focusPropertySlug: property.slug,
          focusDistrictSlug: wrongDistrict,
        }),
      ).toThrow(/does not match district focus/);
    }
  });
});
