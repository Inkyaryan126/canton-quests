import { getDevelopmentBonusesThroughLevel } from '../core/development';
import {
  resolvePropertyIncomeRate,
  resolveTerritoryIncomeRate,
  settleGridResources,
} from '../core/resources';
import type { GridCityPackage } from '../core/types';
import type { GridEconomyCommandPort } from './economy-port';
import { settleGridPlayerResources } from './economy-service';
import type { GridOnboardingSeasonPort } from './onboarding-season-port';
import type {
  GridReturnResourceState,
  GridReturnSummaryPort,
} from './return-summary-port';

const HOUR_MS = 60 * 60 * 1000;

export type GridOnboardingIncomeState =
  | 'unavailable'
  | 'income-not-started'
  | 'accumulating'
  | 'collectible';

export interface GridOnboardingIncomeProjection {
  state: GridOnboardingIncomeState;
  pendingCredits: number;
  pendingInfluence: number;
  creditsPerHour: number;
  influencePerHour: number;
  collectibleAt: string | null;
  wallet: {
    credits: number;
    influence: number;
    commandPoints: number;
  } | null;
}
type GridOnboardingIncomeReadPort = Pick<GridReturnSummaryPort, 'getContext'>;

function incomeRates(
  pkg: GridCityPackage,
  state: GridReturnResourceState,
): { creditsPerHour: number; influencePerHour: number } {
  const economy = pkg.seasonTemplate.economy;
  if (!economy) return { creditsPerHour: 0, influencePerHour: 0 };

  let creditsPerHour = 0;
  let influencePerHour = 0;

  for (const slug of state.ownedTerritorySlugs) {
    const rate = resolveTerritoryIncomeRate(economy, slug);
    creditsPerHour += rate.creditsPerHour;
    influencePerHour += rate.influencePerHour;
  }

  for (const property of state.ownedProperties) {
    const rate = resolvePropertyIncomeRate(economy, property.propertySlug);
    creditsPerHour += rate.creditsPerHour;
    influencePerHour += rate.influencePerHour;

    if (property.developmentBranch && property.developmentLevel > 0) {
      const bonuses = getDevelopmentBonusesThroughLevel(
        economy.development,
        property.developmentBranch,
        property.developmentLevel,
      );
      creditsPerHour += bonuses.creditsPerHour;
      influencePerHour += bonuses.influencePerHour;
    }
  }

  return { creditsPerHour, influencePerHour };
}
function msUntilWholeResource(ratePerHour: number, remainder: number): number | null {
  if (ratePerHour <= 0) return null;
  return Math.max(1, Math.ceil((HOUR_MS - remainder) / ratePerHour));
}

function nextCollectibleAt(
  generatedAt: string,
  creditsPerHour: number,
  influencePerHour: number,
  creditsRemainder: number,
  influenceRemainder: number,
): string | null {
  const waits = [
    msUntilWholeResource(creditsPerHour, creditsRemainder),
    msUntilWholeResource(influencePerHour, influenceRemainder),
  ].filter((value): value is number => value !== null);

  if (waits.length === 0) return null;
  return new Date(Date.parse(generatedAt) + Math.min(...waits)).toISOString();
}

export async function projectGridOnboardingIncome(
  port: GridOnboardingIncomeReadPort,
  pkg: GridCityPackage,
  playerId: string,
  generatedAt: string,
): Promise<GridOnboardingIncomeProjection> {
  if (!playerId.trim()) {
    throw new Error('Grid onboarding income projection requires playerId');
  }
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('Grid onboarding income projection requires a valid generatedAt timestamp');
  }

  const economy = pkg.seasonTemplate.economy;
  if (!economy) {
    throw new Error('Grid onboarding income projection requires economy config');
  }
  const context = await port.getContext(playerId);
  if (!context) {
    return {
      state: 'unavailable',
      pendingCredits: 0,
      pendingInfluence: 0,
      creditsPerHour: 0,
      influencePerHour: 0,
      collectibleAt: null,
      wallet: null,
    };
  }

  const rates = incomeRates(pkg, context.resources);
  const settlement = settleGridResources({
    credits: context.resources.credits,
    influence: context.resources.influence,
    creditsPerHour: rates.creditsPerHour,
    influencePerHour: rates.influencePerHour,
    remainders: {
      credits: context.resources.creditsAccrualRemainder,
      influence: context.resources.influenceAccrualRemainder,
    },
    lastSettledAtMs: Date.parse(context.resources.resourcesSettledAt),
    nowMs: Date.parse(generatedAt),
    offlineAccrualCapMinutes: economy.offlineAccrualCapMinutes,
  });

  const developed = context.resources.ownedProperties.some(
    (property) => property.developmentLevel > 0,
  );
  const collectible =
    settlement.creditsEarned > 0 || settlement.influenceEarned > 0;

  let state: GridOnboardingIncomeState = 'accumulating';
  if (!developed || (rates.creditsPerHour <= 0 && rates.influencePerHour <= 0)) {
    state = 'income-not-started';
  } else if (collectible) {
    state = 'collectible';
  }
  return {
    state,
    pendingCredits: settlement.creditsEarned,
    pendingInfluence: settlement.influenceEarned,
    creditsPerHour: rates.creditsPerHour,
    influencePerHour: rates.influencePerHour,
    collectibleAt:
      state === 'accumulating'
        ? nextCollectibleAt(
            generatedAt,
            rates.creditsPerHour,
            rates.influencePerHour,
            settlement.remainders.credits,
            settlement.remainders.influence,
          )
        : null,
    wallet: {
      credits: context.resources.credits,
      influence: context.resources.influence,
      commandPoints: context.resources.commandPoints,
    },
  };
}

export interface GridOnboardingIncomeCollectRequest {
  playerId: string;
  idempotencyKey: string;
  now: string;
}

export async function collectGridOnboardingIncome(
  readPort: GridOnboardingIncomeReadPort,
  seasonPort: GridOnboardingSeasonPort,
  economyPort: GridEconomyCommandPort,
  pkg: GridCityPackage,
  request: GridOnboardingIncomeCollectRequest,
) {
  if (!request.idempotencyKey.trim()) {
    throw new Error('Grid onboarding income collection requires a non-empty idempotency key');
  }

  const preview = await projectGridOnboardingIncome(
    readPort,
    pkg,
    request.playerId,
    request.now,
  );
  if (preview.state !== 'collectible') {
    throw new Error(
      preview.collectibleAt
        ? `Grid onboarding income is still accumulating until ${preview.collectibleAt}`
        : 'Grid onboarding income is not collectible yet',
    );
  }
  const season = await seasonPort.getCurrentSeason();
  if (!season || !['active', 'surge'].includes(season.status)) {
    throw new Error('Grid onboarding season is not active');
  }

  const result = await settleGridPlayerResources(economyPort, {
    seasonId: season.seasonId,
    playerId: request.playerId,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  return {
    creditsCollected: preview.pendingCredits,
    influenceCollected: preview.pendingInfluence,
    credits: result.credits,
    influence: result.influence,
    commandPoints: result.commandPoints,
    resourcesSettledAt: result.resourcesSettledAt,
  };
}
