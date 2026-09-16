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
  const runtimeBySlug = new Map(
    context.territories.map((territory) => [
      territory.territorySlug,
      territory,
    ] as const),
  );

  const options = pkg.territories.flatMap((territory) => {
    if (!configured.has(territory.slug)) return [];
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

  const unavailableCount = economy.neutralClaims.starterTerritorySlugs.length -
    options.length;

  return {
    state: options.length > 0 ? 'choose-starter' : 'no-starters-available',
    availableCount: options.length,
    unavailableCount,
    options,
  };
}
