import type { GridEconomyCommandPort } from './economy-port';
import { settleGridPlayerResources } from './economy-service';
import type { GridIncomeActionPort } from './income-action-port';

export interface GridIncomeCollectRequest {
  playerId: string;
  idempotencyKey: string;
  now: string;
}

export async function collectGridWorldIncome(
  seasonPort: GridIncomeActionPort,
  economyPort: GridEconomyCommandPort,
  request: GridIncomeCollectRequest,
) {
  if (!request.playerId.trim()) {
    throw new Error('Grid income collection requires playerId');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error(
      'Grid income collection requires a non-empty idempotency key',
    );
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error('Grid income collection requires a valid now timestamp');
  }

  const season = await seasonPort.getCurrentSeason();
  if (!season || !['active', 'surge'].includes(season.seasonStatus)) {
    throw new Error('Grid income collection requires an active season');
  }

  const result = await settleGridPlayerResources(economyPort, {
    seasonId: season.seasonId,
    playerId: request.playerId,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  return {
    credits: result.credits,
    influence: result.influence,
    commandPoints: result.commandPoints,
    resourcesSettledAt: result.resourcesSettledAt,
  };
}
