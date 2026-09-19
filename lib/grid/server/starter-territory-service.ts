import { resolveTerritoryClaimCost } from '../core/resources';
import type { GridCityPackage } from '../core/types';
import type { GridStarterTerritoryPort } from './starter-territory-port';

export type GridStarterTerritoryState =
  | 'season-unavailable'
  | 'join-required'
  | 'choose-starter'
  | 'starter-claim-complete'
  | 'no-starters-available';

export interface GridStarterTerritoryProjection {
  state: GridStarterTerritoryState;
  availableCount: number;
  unavailableCount: number;
  options: Array<{
    territoryId: string;
    slug: string;
    name: string;
    districtSlug: string;
    baseValue: number;
    cost: {
      credits: number;
      commandPoints: number;
    };
    affordable: boolean;
  }>;
}

export async function isGridStarterTerritoryEligible(
  port: GridStarterTerritoryPort,
  pkg: GridCityPackage,
  playerId: string,
  territoryId: string,
): Promise<boolean> {
  if (!playerId.trim() || !territoryId.trim()) return false;

  const economy = pkg.seasonTemplate.economy;
  if (!economy) return false;

  const context = await port.getContext(playerId);
  if (!context.seasonPlayable || !context.joined) return false;

  const configured = new Set(economy.neutralClaims.starterTerritorySlugs);
  const buildableConfigured = new Set(
    pkg.properties
      .map((property) => property.territorySlug)
      .filter((territorySlug) => configured.has(territorySlug)),
  );

  const territory = context.territories.find(
    (candidate) => candidate.territoryId === territoryId,
  );
  return territory ? buildableConfigured.has(territory.territorySlug) : false;
}

export async function readGridStarterTerritories(
  port: GridStarterTerritoryPort,
  pkg: GridCityPackage,
  playerId: string,
): Promise<GridStarterTerritoryProjection> {
  if (!playerId.trim()) {
    throw new Error('Grid starter territory selection requires playerId');
  }

  const economy = pkg.seasonTemplate.economy;
  if (!economy) {
    throw new Error('Grid starter territory selection requires economy config');
  }

  const context = await port.getContext(playerId);
  if (!context.seasonPlayable) {
    return {
      state: 'season-unavailable',
      availableCount: 0,
      unavailableCount: 0,
      options: [],
    };
  }

  if (!context.joined) {
    return {
      state: 'join-required',
      availableCount: 0,
      unavailableCount: 0,
      options: [],
    };
  }

  if (context.ownsAnyTerritory) {
    return {
      state: 'starter-claim-complete',
      availableCount: 0,
      unavailableCount: 0,
      options: [],
    };
  }

  const configured = new Set(economy.neutralClaims.starterTerritorySlugs);
  const buildableConfigured = new Set(
    pkg.properties
      .map((property) => property.territorySlug)
      .filter((territorySlug) => configured.has(territorySlug)),
  );
  const runtimeBySlug = new Map(
    context.territories.map((territory) => [
      territory.territorySlug,
      territory,
    ] as const),
  );

  const options = pkg.territories.flatMap((territory) => {
    if (!buildableConfigured.has(territory.slug)) return [];
    const runtime = runtimeBySlug.get(territory.slug);
    if (!runtime || runtime.occupied) return [];

    const cost = resolveTerritoryClaimCost(economy, territory.slug);
    return [{
      territoryId: runtime.territoryId,
      slug: territory.slug,
      name: territory.name,
      districtSlug: territory.districtSlug,
      baseValue: territory.baseValue,
      cost,
      affordable:
        context.credits >= cost.credits &&
        context.commandPoints >= cost.commandPoints,
    }];
  }).sort((a, b) => a.slug.localeCompare(b.slug));

  const unavailableCount = buildableConfigured.size - options.length;

  return {
    state: options.length > 0 ? 'choose-starter' : 'no-starters-available',
    availableCount: options.length,
    unavailableCount,
    options,
  };
}
