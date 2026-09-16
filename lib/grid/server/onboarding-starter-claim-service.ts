import type { GridOnboardingSeasonPort } from './onboarding-season-port';
import type { GridOnboardingStarterClaimPort } from './onboarding-starter-claim-port';

export interface GridOnboardingStarterClaimRequest {
  playerId: string;
  territoryId: string;
  idempotencyKey: string;
  now: string;
}

export interface GridOnboardingStarterClaimResult {
  territoryId: string;
  territorySlug: string;
  claimedAt: string;
  creditsSpent: number;
  commandPointsSpent: number;
  credits: number;
  influence: number;
  commandPoints: number;
  eventId: string;
}

export async function claimGridOnboardingStarterTerritory(
  seasonPort: GridOnboardingSeasonPort,
  claimPort: GridOnboardingStarterClaimPort,
  request: GridOnboardingStarterClaimRequest,
): Promise<GridOnboardingStarterClaimResult> {
  if (!request.playerId.trim()) {
    throw new Error('Grid onboarding starter claim requires playerId');
  }
  if (!request.territoryId.trim()) {
    throw new Error('Grid onboarding starter claim requires territoryId');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error(
      'Grid onboarding starter claim requires a non-empty idempotency key',
    );
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error(
      'Grid onboarding starter claim requires a valid now timestamp',
    );
  }

  const season = await seasonPort.getCurrentSeason();
  if (!season || !['active', 'surge'].includes(season.status)) {
    throw new Error('Grid onboarding season is not active');
  }

  const claim = await claimPort.claimStarterTerritory({
    seasonId: season.seasonId,
    playerId: request.playerId,
    territoryId: request.territoryId,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  if (claim.claimMode !== 'starter') {
    throw new Error(
      'Grid onboarding starter claim returned a non-starter claim mode',
    );
  }

  return {
    territoryId: claim.territoryId,
    territorySlug: claim.territorySlug,
    claimedAt: claim.claimedAt,
    creditsSpent: claim.creditsSpent,
    commandPointsSpent: claim.commandPointsSpent,
    credits: claim.credits,
    influence: claim.influence,
    commandPoints: claim.commandPoints,
    eventId: claim.eventId,
  };
}
