import { getNextDevelopmentLevel } from '../core/development';
import {
  GRID_DEVELOPMENT_BRANCHES,
  type GridDevelopmentBranch,
  type GridEconomyCost,
} from '../core/economy-types';
import { resolvePropertyAcquisitionCost } from '../core/resources';
import type { GridCityPackage } from '../core/types';
import type { GridOnboardingPropertyRefPort } from './onboarding-property-port';
import type { GridOnboardingSeasonPort } from './onboarding-season-port';
import type { GridPropertyCommandPort } from './property-port';
import { acquireGridProperty, developGridProperty } from './property-service';
import {
  buildGridWorldProjection,
  type GridWorldRuntimeSnapshot,
} from './world-projection';

export type GridOnboardingPropertyState =
  | 'season-unavailable'
  | 'join-required'
  | 'claim-required'
  | 'acquire-property'
  | 'develop-property'
  | 'upgrade-complete'
  | 'no-buildable-property';

export interface GridOnboardingDevelopmentOption {
  branch: GridDevelopmentBranch;
  level: number;
  cost: GridEconomyCost;
  affordable: boolean;
}
export interface GridOnboardingPropertyOption {
  slug: string;
  name: string;
  territorySlug: string;
  owned: boolean;
  developmentBranch: GridDevelopmentBranch | null;
  developmentLevel: number;
  acquisitionCost: GridEconomyCost;
  affordableToAcquire: boolean;
  developmentOptions: GridOnboardingDevelopmentOption[];
}

export interface GridOnboardingPropertyProjection {
  state: GridOnboardingPropertyState;
  wallet: {
    credits: number;
    influence: number;
    commandPoints: number;
  } | null;
  options: GridOnboardingPropertyOption[];
}

function canAfford(
  wallet: { credits: number; commandPoints: number },
  cost: GridEconomyCost,
): boolean {
  return (
    wallet.credits >= cost.credits &&
    wallet.commandPoints >= cost.commandPoints
  );
}
export function projectGridOnboardingProperties(
  pkg: GridCityPackage,
  runtime: GridWorldRuntimeSnapshot | null,
  playerId: string,
): GridOnboardingPropertyProjection {
  if (!playerId.trim()) {
    throw new Error('Grid onboarding property projection requires playerId');
  }

  const economy = pkg.seasonTemplate.economy;
  if (!economy) {
    throw new Error('Grid onboarding property projection requires economy config');
  }

  if (
    !runtime ||
    (runtime.seasonStatus !== 'active' && runtime.seasonStatus !== 'surge')
  ) {
    return { state: 'season-unavailable', wallet: null, options: [] };
  }

  const world = buildGridWorldProjection(pkg, {
    viewerPlayerId: playerId,
    runtime,
  });
  const wallet = world.player.wallet;
  if (!wallet) {
    return { state: 'join-required', wallet: null, options: [] };
  }
  const projectedWallet = {
    credits: wallet.credits,
    influence: wallet.influence,
    commandPoints: wallet.commandPoints,
  };
  const ownedTerritories = new Set(
    world.territories
      .filter((territory) => territory.ownership === 'you')
      .map((territory) => territory.slug),
  );

  if (ownedTerritories.size === 0) {
    return {
      state: 'claim-required',
      wallet: projectedWallet,
      options: [],
    };
  }

  const options = world.properties
    .filter(
      (property) =>
        ownedTerritories.has(property.territorySlug) &&
        property.ownership !== 'occupied',
    )
    .map((property): GridOnboardingPropertyOption => {
      const acquisitionCost = resolvePropertyAcquisitionCost(
        economy,
        property.slug,
      );
      const branches = property.developmentBranch
        ? [property.developmentBranch]
        : [...GRID_DEVELOPMENT_BRANCHES];
      const developmentOptions = branches.flatMap((branch) => {
        const next = getNextDevelopmentLevel(
          economy.development,
          branch,
          property.developmentLevel,
        );
        return next
          ? [{
              branch,
              level: next.level,
              cost: { ...next.cost },
              affordable: canAfford(projectedWallet, next.cost),
            }]
          : [];
      });

      return {
        slug: property.slug,
        name: property.name,
        territorySlug: property.territorySlug,
        owned: property.ownership === 'you',
        developmentBranch: property.developmentBranch,
        developmentLevel: property.developmentLevel,
        acquisitionCost,
        affordableToAcquire:
          property.ownership === 'neutral' &&
          canAfford(projectedWallet, acquisitionCost),
        developmentOptions,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  let state: GridOnboardingPropertyState = 'no-buildable-property';
  if (options.some((option) => option.owned && option.developmentLevel > 0)) {
    state = 'upgrade-complete';
  } else if (options.some((option) => option.owned)) {
    state = 'develop-property';
  } else if (options.length > 0) {
    state = 'acquire-property';
  }

  return { state, wallet: projectedWallet, options };
}

interface GridOnboardingPropertyCommandRequest {
  playerId: string;
  propertySlug: string;
  idempotencyKey: string;
  now: string;
}

export interface GridOnboardingDevelopPropertyRequest
  extends GridOnboardingPropertyCommandRequest {
  branch: GridDevelopmentBranch;
}

function validateCommandRequest(
  request: GridOnboardingPropertyCommandRequest,
): void {
  if (!request.playerId.trim() || !request.propertySlug.trim()) {
    throw new Error(
      'Grid onboarding property command requires playerId and propertySlug',
    );
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error(
      'Grid onboarding property command requires a non-empty idempotency key',
    );
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error('Grid onboarding property command requires a valid now timestamp');
  }
}
async function resolveCommandTarget(
  seasonPort: GridOnboardingSeasonPort,
  propertyPort: GridOnboardingPropertyRefPort,
  propertySlug: string,
): Promise<{ seasonId: string; propertyId: string }> {
  const season = await seasonPort.getCurrentSeason();
  if (!season || !['active', 'surge'].includes(season.status)) {
    throw new Error('Grid onboarding season is not active');
  }

  const propertyId = await propertyPort.resolvePropertyId(propertySlug);
  if (!propertyId) {
    throw new Error('Grid onboarding property was not found');
  }

  return { seasonId: season.seasonId, propertyId };
}

export async function acquireGridOnboardingProperty(
  seasonPort: GridOnboardingSeasonPort,
  propertyRefPort: GridOnboardingPropertyRefPort,
  commandPort: GridPropertyCommandPort,
  request: GridOnboardingPropertyCommandRequest,
) {
  validateCommandRequest(request);
  const target = await resolveCommandTarget(
    seasonPort,
    propertyRefPort,
    request.propertySlug,
  );
  const result = await acquireGridProperty(commandPort, {
    seasonId: target.seasonId,
    playerId: request.playerId,
    propertyId: target.propertyId,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  return {
    propertySlug: result.propertySlug,
    creditsSpent: result.creditsSpent,
    commandPointsSpent: result.commandPointsSpent,
    credits: result.credits,
    influence: result.influence,
    commandPoints: result.commandPoints,
    acquiredAt: result.acquiredAt,
  };
}

export async function developGridOnboardingProperty(
  seasonPort: GridOnboardingSeasonPort,
  propertyRefPort: GridOnboardingPropertyRefPort,
  commandPort: GridPropertyCommandPort,
  request: GridOnboardingDevelopPropertyRequest,
) {
  validateCommandRequest(request);
  const target = await resolveCommandTarget(
    seasonPort,
    propertyRefPort,
    request.propertySlug,
  );
  const result = await developGridProperty(commandPort, {
    seasonId: target.seasonId,
    playerId: request.playerId,
    propertyId: target.propertyId,
    branch: request.branch,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  return {
    propertySlug: result.propertySlug,
    developmentBranch: result.developmentBranch,
    previousLevel: result.previousLevel,
    developmentLevel: result.developmentLevel,
    creditsSpent: result.creditsSpent,
    commandPointsSpent: result.commandPointsSpent,
    credits: result.credits,
    influence: result.influence,
    commandPoints: result.commandPoints,
    developedAt: result.developedAt,
    skylineFormed: Boolean(result.skylineEventId),
  };
}
