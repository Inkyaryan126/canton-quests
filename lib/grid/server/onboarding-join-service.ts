import { joinGridSeason } from './economy-service';
import type { GridEconomyCommandPort } from './economy-port';
import type { GridOnboardingHomeCityPort } from './onboarding-home-city-port';
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

function validatePersistedJoinState(
  state: unknown,
  playerId: string,
  seasonId: string,
): asserts state is {
  seasonId: string;
  playerId: string;
  joined: boolean;
  credits: number;
  influence: number;
  commandPoints: number;
  resourcesSettledAt: string;
} {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('Grid onboarding join returned no persisted wallet state');
  }

  const persisted = state as Record<string, unknown>;
  if (persisted.seasonId !== seasonId) {
    throw new Error('Grid onboarding join returned state for a different season');
  }
  if (persisted.playerId !== playerId) {
    throw new Error('Grid onboarding join returned state for a different player');
  }
  if (typeof persisted.joined !== 'boolean') {
    throw new Error('Grid onboarding join returned an invalid join state');
  }
  for (const field of ['credits', 'influence', 'commandPoints']) {
    const value = persisted[field];
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
      throw new Error(`Grid onboarding join returned an invalid ${field} balance`);
    }
  }
  if (
    typeof persisted.resourcesSettledAt !== 'string' ||
    !Number.isFinite(Date.parse(persisted.resourcesSettledAt))
  ) {
    throw new Error(
      'Grid onboarding join returned an invalid persisted resource timestamp',
    );
  }
}

export async function joinGridOnboardingSeason(
  homeCityPort: GridOnboardingHomeCityPort,
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

  const homeCityConfirmed = await homeCityPort.isHomeCityConfirmed(
    request.playerId,
  );
  if (!homeCityConfirmed) {
    throw new Error('Grid onboarding Home City must be confirmed before joining');
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

  validatePersistedJoinState(state, request.playerId, season.seasonId);

  return {
    joined: state.joined,
    credits: state.credits,
    influence: state.influence,
    commandPoints: state.commandPoints,
    resourcesSettledAt: state.resourcesSettledAt,
  };
}
