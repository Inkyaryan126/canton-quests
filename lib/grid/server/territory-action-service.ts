import type { GridTerritoryClaimPort } from './territory-claim-port';
import { claimNeutralGridTerritory } from './territory-claim-service';
import type { GridTerritoryActionPort } from './territory-action-port';

export interface GridTerritoryActionRequest {
  playerId: string;
  territorySlug: string;
  idempotencyKey: string;
  now: string;
}

export async function claimGridWorldTerritory(
  targetPort: GridTerritoryActionPort,
  claimPort: GridTerritoryClaimPort,
  request: GridTerritoryActionRequest,
) {
  if (!request.playerId.trim() || !request.territorySlug.trim()) {
    throw new Error('Grid territory action requires playerId and territorySlug');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error('Grid territory action requires a non-empty idempotency key');
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error('Grid territory action requires a valid now timestamp');
  }

  const target = await targetPort.resolveTarget(request.territorySlug);
  if (!target || !['active', 'surge'].includes(target.seasonStatus)) {
    throw new Error('Grid territory action requires an active season and valid target');
  }

  const result = await claimNeutralGridTerritory(claimPort, {
    seasonId: target.seasonId,
    playerId: request.playerId,
    territoryId: target.territoryId,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  return {
    territorySlug: result.territorySlug,
    claimMode: result.claimMode,
    claimedAt: result.claimedAt,
    creditsSpent: result.creditsSpent,
    commandPointsSpent: result.commandPointsSpent,
    credits: result.credits,
    influence: result.influence,
    commandPoints: result.commandPoints,
  };
}
