import { signalDiceForCommit } from '../core/contest';
import type { GridContestConfig } from '../core/contest-types';
import { startGridPveStrongholdContest } from '../core/pve-stronghold-contest';
import type { GridSignalDiceRoller } from './contest-service';
import type {
  GridPveStrongholdSessionPort,
  GridResolvePveStrongholdRoundResult,
  GridStartPveStrongholdSessionResult,
} from './pve-stronghold-session-port';

export interface GridLaunchPveStrongholdRequest {
  attackerPlayerId: string;
  sourceTerritorySlug: string;
  strongholdId: string;
  attackerCommittedInfluence: number;
  idempotencyKey: string;
  now: string;
}

export interface GridResolvePveStrongholdSessionRoundRequest {
  contestId: string;
  attackerPlayerId: string;
  idempotencyKey: string;
  now: string;
}

function requireNonBlank(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid PvE stronghold session requires ${label}`);
  return normalized;
}

function requireTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid PvE stronghold session requires a valid now timestamp');
  }
}

function requirePositiveInfluence(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Grid PvE stronghold session requires positive attackerCommittedInfluence');
  }
}

function rollMany(
  roller: GridSignalDiceRoller,
  count: number,
  dieSides: number,
): number[] {
  return Array.from({ length: count }, () => {
    const roll = roller.roll(dieSides);
    if (!Number.isInteger(roll) || roll < 1 || roll > dieSides) {
      throw new Error(`Grid PvE Signal Dice returned invalid d${dieSides} result: ${roll}`);
    }
    return roll;
  });
}

export async function launchGridPveStrongholdSession(
  port: GridPveStrongholdSessionPort,
  request: GridLaunchPveStrongholdRequest,
): Promise<GridStartPveStrongholdSessionResult> {
  const attackerPlayerId = requireNonBlank(request.attackerPlayerId, 'attackerPlayerId');
  const sourceTerritorySlug = requireNonBlank(request.sourceTerritorySlug, 'sourceTerritorySlug');
  const strongholdId = requireNonBlank(request.strongholdId, 'strongholdId');
  requireNonBlank(request.idempotencyKey, 'a non-empty idempotency key');
  requireTimestamp(request.now);
  requirePositiveInfluence(request.attackerCommittedInfluence);

  const context = await port.getStartContext({
    attackerPlayerId,
    sourceTerritorySlug,
    strongholdId,
    now: request.now,
  });

  if (
    context.attackerPlayerId !== attackerPlayerId ||
    context.sourceTerritorySlug !== sourceTerritorySlug ||
    context.stronghold.strongholdId !== strongholdId
  ) {
    throw new Error('Grid PvE stronghold context identity mismatch');
  }
  requireNonBlank(context.seasonId, 'context seasonId');
  requireNonBlank(context.cityId, 'context cityId');
  requireNonBlank(context.targetTerritoryId, 'context targetTerritoryId');

  const state = startGridPveStrongholdContest({
    stronghold: context.stronghold,
    attackerCommittedInfluence: request.attackerCommittedInfluence,
  });

  return port.startContest({
    seasonId: context.seasonId,
    cityId: context.cityId,
    strongholdId: state.strongholdId,
    factionId: state.factionId,
    attackerPlayerId,
    sourceTerritoryId: context.sourceTerritoryId,
    targetTerritoryId: context.targetTerritoryId,
    objectiveKind: state.objective.kind,
    landmarkSlug: state.objective.landmarkSlug ?? null,
    attackerCommittedInfluence: state.attackerInitialInfluence,
    garrisonCommittedInfluence: state.garrisonInitialInfluence,
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });
}

export async function resolveGridPveStrongholdSessionRound(
  port: GridPveStrongholdSessionPort,
  roller: GridSignalDiceRoller,
  contestConfig: GridContestConfig,
  request: GridResolvePveStrongholdSessionRoundRequest,
): Promise<GridResolvePveStrongholdRoundResult> {
  const contestId = requireNonBlank(request.contestId, 'contestId');
  const attackerPlayerId = requireNonBlank(request.attackerPlayerId, 'attackerPlayerId');
  requireNonBlank(request.idempotencyKey, 'a non-empty idempotency key');
  requireTimestamp(request.now);

  const context = await port.getRoundContext(contestId);
  if (context.contestId !== contestId) {
    throw new Error('Grid PvE stronghold round context contest mismatch');
  }
  if (context.status !== 'active') {
    throw new Error('Grid PvE stronghold round requires an active contest');
  }
  if (context.attackerPlayerId !== attackerPlayerId) {
    throw new Error('Grid PvE stronghold round requires the contest attacker');
  }

  const attackerDice = signalDiceForCommit(
    context.attackerRemainingInfluence,
    contestConfig.attacker,
  );
  const garrisonDice = signalDiceForCommit(
    context.garrisonRemainingInfluence,
    contestConfig.defender,
  );
  if (attackerDice <= 0) {
    throw new Error('Grid PvE stronghold attacker cannot continue');
  }
  if (garrisonDice <= 0) {
    throw new Error('Grid PvE stronghold garrison cannot continue');
  }

  return port.resolveRound({
    contestId,
    attackerPlayerId,
    attackerRolls: rollMany(roller, attackerDice, contestConfig.dieSides),
    garrisonRolls: rollMany(roller, garrisonDice, contestConfig.dieSides),
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });
}
