import { decideOfflineDefense } from '../core/offline-defense';
import { DEFAULT_GRID_OFFLINE_DEFENSE_POLICY } from '../core/offline-defense-default';
import type { GridContestConfig } from '../core/contest-types';
import { getGridOfflineDefensePolicy } from './offline-defense-service';
import type { GridOfflineDefensePolicyPort } from './offline-defense-port';
import { startGridContest } from './contest-session-service';
import { settleGridPlayerResources } from './economy-service';
import type { GridEconomyCommandPort } from './economy-port';
import type {
  GridContestSessionPort,
  GridStartContestResult,
} from './contest-session-port';
import type {
  GridContestAttackPort,
  GridContestAutoRetreatResult,
} from './contest-attack-port';

export interface GridLaunchContestAttackRequest {
  attackerPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  attackerCommittedInfluence: number;
  idempotencyKey: string;
  now: string;
}

export type GridLaunchContestAttackResult =
  | {
      outcome: 'contest-started';
      contest: GridStartContestResult;
    }
  | {
      outcome: 'captured-by-auto-retreat';
      capture: GridContestAutoRetreatResult;
    };

function validateRequest(request: GridLaunchContestAttackRequest): void {
  if (
    !request.attackerPlayerId.trim() ||
    !request.sourceTerritoryId.trim() ||
    !request.targetTerritoryId.trim()
  ) {
    throw new Error('Grid attack requires attacker, source, and target ids');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error('Grid attack requires a non-empty idempotency key');
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error('Grid attack requires a valid now timestamp');
  }
  if (
    !Number.isInteger(request.attackerCommittedInfluence) ||
    request.attackerCommittedInfluence <= 0
  ) {
    throw new Error('Grid attack requires positive integer attackerCommittedInfluence');
  }
}

export async function launchGridContestAttack(
  attackPort: GridContestAttackPort,
  sessionPort: GridContestSessionPort,
  defensePolicyPort: GridOfflineDefensePolicyPort,
  economyPort: GridEconomyCommandPort,
  contestConfig: GridContestConfig,
  request: GridLaunchContestAttackRequest,
): Promise<GridLaunchContestAttackResult> {
  validateRequest(request);

  const context = await attackPort.getAttackContext({
    attackerPlayerId: request.attackerPlayerId,
    sourceTerritoryId: request.sourceTerritoryId,
    targetTerritoryId: request.targetTerritoryId,
  });

  const [savedPolicy, defenderState] = await Promise.all([
    getGridOfflineDefensePolicy(
      defensePolicyPort,
      context.seasonId,
      context.defenderPlayerId,
    ),
    settleGridPlayerResources(economyPort, {
      seasonId: context.seasonId,
      playerId: context.defenderPlayerId,
      idempotencyKey: `preattack:defender:${request.idempotencyKey}`,
      now: request.now,
    }),
  ]);
  const policy = savedPolicy?.policy ?? DEFAULT_GRID_OFFLINE_DEFENSE_POLICY;
  const minimumViableCommit = Math.min(
    ...contestConfig.defender.bands.map((band) => band.minCommittedInfluence),
  );

  const decision = decideOfflineDefense(policy, {
    targetTerritorySlug: context.targetTerritorySlug,
    reserveInfluenceAvailable: defenderState.influence,
    currentDefenderInfluence: defenderState.influence,
    cumulativeInfluenceLost: 0,
    minimumViableCommit,
  });

  if (decision.action === 'withdraw') {
    const capture = await attackPort.captureByAutoRetreat({
      seasonId: context.seasonId,
      attackerPlayerId: request.attackerPlayerId,
      defenderPlayerId: context.defenderPlayerId,
      sourceTerritoryId: request.sourceTerritoryId,
      targetTerritoryId: request.targetTerritoryId,
      defenseDoctrineId: policy.doctrineId,
      defenseReason: decision.reason,
      defenseTactic: decision.tactic,
      idempotencyKey: request.idempotencyKey,
      now: request.now,
    });
    return { outcome: 'captured-by-auto-retreat', capture };
  }

  const contest = await startGridContest(sessionPort, {
    seasonId: context.seasonId,
    attackerPlayerId: request.attackerPlayerId,
    defenderPlayerId: context.defenderPlayerId,
    sourceTerritoryId: request.sourceTerritoryId,
    targetTerritoryId: request.targetTerritoryId,
    attackerCommittedInfluence: request.attackerCommittedInfluence,
    defenderCommittedInfluence: decision.committedInfluence,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });

  return { outcome: 'contest-started', contest };
}
