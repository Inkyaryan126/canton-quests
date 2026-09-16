import { joinGridSeason } from './economy-service';
import type { GridEconomyCommandPort } from './economy-port';
import type { GridOnboardingSeasonPort } from './onboarding-season-port';

export interface GridOnboardingJoinRequest {
  playerId: string;
  idempotencyKey: string;
  now: string;
}

export interface GridOnboardingJoinResult {
  joined: boolean;
  credits: number;
  influence: number;
  commandPoints: number;
  resourcesSettledAt: string;
}

export async function joinGridOnboardingSeason(
  seasonPort: GridOnboardingSeasonPort,
  economyPort: GridEconomyCommandPort,
  request: GridOnboardingJoinRequest,
): Promise<GridOnboardingJoinResult> {
  if (!request.playerId.trim()) {
    throw new Error('Grid onboarding join requires playerId');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error('Grid onboarding join requires a non-empty idempotency key');
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error('Grid onboarding join requires a valid now timestamp');
  }

  const season = await seasonPort.getCurrentSeason();
  if (!season || !['active', 'surge'].includes(season.status)) {
    throw new Error('Grid onboarding season is not active');
  }

  const state = await joinGridSeason(economyPort, {
    seasonId: season.seasonId,
    playerId: request.playerId,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  return {
    joined: state.joined,
    credits: state.credits,
    influence: state.influence,
    commandPoints: state.commandPoints,
    resourcesSettledAt: state.resourcesSettledAt,
  };
}
