import type { GridDevelopmentBranch } from '../core/economy-types';
import { computeSkylineComponents, matchSkylineRules } from '../core/skyline';
import { projectTerritoryControl } from '../core/territory-control';
import type { GridCityPackage } from '../core/types';

export type GridWorldOwnership = 'neutral' | 'you' | 'occupied';

export interface GridWorldRuntimeTerritoryState {
  territorySlug: string;
  ownerPlayerId: string | null;
  claimedAt: string | null;
}

export interface GridWorldRuntimePropertyState {
  propertySlug: string;
  ownerPlayerId: string | null;
  acquiredAt: string | null;
  developmentBranch: GridDevelopmentBranch | null;
  developmentLevel: number;
  conditionBps: number;
}

export interface GridWorldRuntimePlayerState {
  credits: number;
  influence: number;
  commandPoints: number;
  resourcesSettledAt: string;
}
export interface GridWorldRuntimeSnapshot {
  seasonId: string;
  seasonStatus: string;
  territories: GridWorldRuntimeTerritoryState[];
  properties: GridWorldRuntimePropertyState[];
  playerState: GridWorldRuntimePlayerState | null;
}

export interface GridWorldProjection {
  version: 1;
  readOnly: true;
  source: 'compiled-package' | 'database';
  city: GridCityPackage['city'];
  season: {
    slug: string;
    name: string;
    status: string;
    runtimeActive: boolean;
  };
  player: {
    authenticated: boolean;
    joined: boolean;
    wallet: GridWorldRuntimePlayerState | null;
  };
  counts: {
    districts: number;
    territories: number;
    properties: number;
    occupiedTerritories: number;
    occupiedProperties: number;
  };
  territories: Array<{
    slug: string;
    name: string;
    districtSlug: string;
    geometry?: GeoJSON.MultiPolygon;
    ownership: GridWorldOwnership;
    claimable: boolean;
    starterEligible: boolean;
  }>;
  properties: Array<{
    slug: string;
    name: string;
    territorySlug: string;
    point?: GridCityPackage['city']['mapCenter'];
    geometry?: GeoJSON.MultiPolygon;
    ownership: GridWorldOwnership;
    developmentBranch: GridDevelopmentBranch | null;
    developmentLevel: number;
    conditionBps: number;
  }>;
  validClaimSlugs: string[];
  yourSkylines: Array<{
    propertySlugs: string[];
    territorySlugs: string[];
    totalDevelopmentLevel: number;
    ruleIds: string[];
  }>;
}

function ownershipFor(ownerPlayerId: string | null | undefined, viewerPlayerId: string | null): GridWorldOwnership {
  if (!ownerPlayerId) return 'neutral';
  return viewerPlayerId && ownerPlayerId === viewerPlayerId ? 'you' : 'occupied';
}
export function buildGridWorldProjection(
  pkg: GridCityPackage,
  options: {
    viewerPlayerId?: string | null;
    runtime?: GridWorldRuntimeSnapshot | null;
  } = {},
): GridWorldProjection {
  const viewerPlayerId = options.viewerPlayerId ?? null;
  const runtime = options.runtime ?? null;
  const economy = pkg.seasonTemplate.economy;

  const territoryRuntime = new Map(
    (runtime?.territories ?? []).map((row) => [row.territorySlug, row] as const),
  );
  const propertyRuntime = new Map(
    (runtime?.properties ?? []).map((row) => [row.propertySlug, row] as const),
  );
  const joined = Boolean(viewerPlayerId && runtime?.playerState);

  const control = projectTerritoryControl({
    territories: pkg.territories,
    edges: pkg.edges,
    ownership: pkg.territories.map((territory) => ({
      territorySlug: territory.slug,
      ownerPlayerId: territoryRuntime.get(territory.slug)?.ownerPlayerId ?? null,
    })),
    playerId: viewerPlayerId ?? '__anonymous__',
    starterTerritorySlugs: economy?.neutralClaims.starterTerritorySlugs ?? [],
  });
  const validClaimSlugs = joined ? control.validClaimSlugs : [];
  const validClaims = new Set(validClaimSlugs);
  const starterSlugs = new Set(economy?.neutralClaims.starterTerritorySlugs ?? []);

  const territories = pkg.territories.map((territory) => {
    const state = territoryRuntime.get(territory.slug);
    return {
      slug: territory.slug,
      name: territory.name,
      districtSlug: territory.districtSlug,
      geometry: territory.geometry,
      ownership: ownershipFor(state?.ownerPlayerId, viewerPlayerId),
      claimable: validClaims.has(territory.slug),
      starterEligible: starterSlugs.has(territory.slug),
    };
  });

  const properties = pkg.properties.map((property) => {
    const state = propertyRuntime.get(property.slug);
    return {
      slug: property.slug,
      name: property.publicNameSafe ? property.name : 'Grid Property',
      territorySlug: property.territorySlug,
      point: property.point,
      geometry: property.geometry,
      ownership: ownershipFor(state?.ownerPlayerId, viewerPlayerId),
      developmentBranch: state?.developmentBranch ?? null,
      developmentLevel: state?.developmentLevel ?? 0,
      conditionBps: state?.conditionBps ?? 10000,
    };
  });
  const yourPropertyStates = properties
    .filter((property) => property.ownership === 'you')
    .map((property) => ({
      propertySlug: property.slug,
      territorySlug: property.territorySlug,
      developmentBranch: property.developmentBranch,
      developmentLevel: property.developmentLevel,
    }));

  const yourSkylines = economy
    ? computeSkylineComponents(yourPropertyStates, pkg.edges)
        .map((component) => ({
          propertySlugs: component.propertySlugs,
          territorySlugs: component.territorySlugs,
          totalDevelopmentLevel: component.totalDevelopmentLevel,
          ruleIds: matchSkylineRules(component, economy.skyline.rules).map((rule) => rule.id),
        }))
        .filter((component) => component.ruleIds.length > 0)
    : [];

  return {
    version: 1,
    readOnly: true,
    source: runtime ? 'database' : 'compiled-package',
    city: pkg.city,
    season: {
      slug: pkg.seasonTemplate.slug,
      name: pkg.seasonTemplate.name,
      status: runtime?.seasonStatus ?? 'not-activated',
      runtimeActive: runtime?.seasonStatus === 'active' || runtime?.seasonStatus === 'surge',
    },
    player: {
      authenticated: Boolean(viewerPlayerId),
      joined,
      wallet: runtime?.playerState ?? null,
    },
    counts: {
      districts: pkg.districts.length,
      territories: territories.length,
      properties: properties.length,
      occupiedTerritories: territories.filter((territory) => territory.ownership !== 'neutral').length,
      occupiedProperties: properties.filter((property) => property.ownership !== 'neutral').length,
    },
    territories,
    properties,
    validClaimSlugs,
    yourSkylines,
  };
}
