import type { GridContestConfig } from '../core/contest-types';
import type { GridContestAttackPort } from './contest-attack-port';
import {
  launchGridContestAttack,
  type GridLaunchContestAttackResult,
} from './contest-attack-service';
import type { GridContestBoardPort } from './contest-board-port';
import type { GridContestSessionPort } from './contest-session-port';
import type { GridEconomyCommandPort } from './economy-port';
import type { GridOfflineDefensePolicyPort } from './offline-defense-port';

export interface GridContestBoardLaunchRequest {
  attackerPlayerId: string;
  sourceTerritorySlug: string;
  targetTerritorySlug: string;
  attackerCommittedInfluence: number;
  idempotencyKey: string;
  now: string;
}

function validateRequest(request: GridContestBoardLaunchRequest): void {
  if (
    !request.attackerPlayerId.trim() ||
    !request.sourceTerritorySlug.trim() ||
    !request.targetTerritorySlug.trim()
  ) {
    throw new Error(
      'Grid contest board launch requires attacker, source slug, and target slug',
    );
  }
  if (request.sourceTerritorySlug === request.targetTerritorySlug) {
    throw new Error('Grid contest board source and target must differ');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error(
      'Grid contest board launch requires a non-empty idempotency key',
    );
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error(
      'Grid contest board launch requires a valid now timestamp',
    );
  }
  if (
    !Number.isInteger(request.attackerCommittedInfluence) ||
    request.attackerCommittedInfluence <= 0
  ) {
    throw new Error(
      'Grid contest board launch requires positive committed Influence',
    );
  }
}

function sanitizeResult(
  request: GridContestBoardLaunchRequest,
  result: GridLaunchContestAttackResult,
) {
  if (result.outcome === 'captured-by-auto-retreat') {
    return {
      outcome: result.outcome,
      sourceTerritorySlug: request.sourceTerritorySlug,
      targetTerritorySlug: request.targetTerritorySlug,
      capturedAt: result.capture.capturedAt,
    };
  }

  return {
    outcome: result.outcome,
    contestId: result.contest.contestId,
    sourceTerritorySlug: request.sourceTerritorySlug,
    targetTerritorySlug: request.targetTerritorySlug,
    attackerCommittedInfluence: result.contest.attackerCommittedInfluence,
    defenderCommittedInfluence: result.contest.defenderCommittedInfluence,
    status: result.contest.status,
    startedAt: result.contest.startedAt,
  };
}

export async function launchGridBoardContest(
  boardPort: GridContestBoardPort,
  attackPort: GridContestAttackPort,
  sessionPort: GridContestSessionPort,
  defensePolicyPort: GridOfflineDefensePolicyPort,
  economyPort: GridEconomyCommandPort,
  contestConfig: GridContestConfig,
  request: GridContestBoardLaunchRequest,
) {
  validateRequest(request);

  const ids = await boardPort.resolveTerritoryIds(
    request.sourceTerritorySlug,
    request.targetTerritorySlug,
  );
  if (!ids) {
    throw new Error('Grid contest board could not resolve attack territories');
  }

  const result = await launchGridContestAttack(
    attackPort,
    sessionPort,
    defensePolicyPort,
    economyPort,
    contestConfig,
    {
      attackerPlayerId: request.attackerPlayerId,
      sourceTerritoryId: ids.sourceTerritoryId,
      targetTerritoryId: ids.targetTerritoryId,
      attackerCommittedInfluence: request.attackerCommittedInfluence,
      idempotencyKey: request.idempotencyKey,
      now: request.now,
    },
  );

  return sanitizeResult(request, result);
}
