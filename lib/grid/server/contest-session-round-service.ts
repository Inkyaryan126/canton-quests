import { signalDiceForCommit } from '../core/contest';
import type { GridContestConfig } from '../core/contest-types';
import type { GridSignalDiceRoller } from './contest-service';
import type {
  GridContestSessionRoundPort,
  GridContestSessionRoundResult,
} from './contest-session-round-port';

export interface GridContestSessionRoundRequest {
  contestId: string;
  attackerPlayerId: string;
  idempotencyKey: string;
  now: string;
}

function rollMany(
  roller: GridSignalDiceRoller,
  count: number,
  dieSides: number,
): number[] {
  return Array.from({ length: count }, () => {
    const value = roller.roll(dieSides);
    if (!Number.isInteger(value) || value < 1 || value > dieSides) {
      throw new Error(
        `Grid contest session roller returned invalid d${dieSides} result: ${value}`,
      );
    }
    return value;
  });
}

export async function resolveGridContestSessionRound(
  port: GridContestSessionRoundPort,
  roller: GridSignalDiceRoller,
  config: GridContestConfig,
  request: GridContestSessionRoundRequest,
): Promise<GridContestSessionRoundResult> {
  if (!request.contestId.trim() || !request.attackerPlayerId.trim()) {
    throw new Error('Grid contest session round requires contestId and attackerPlayerId');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error('Grid contest session round requires a non-empty idempotency key');
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error('Grid contest session round requires a valid now timestamp');
  }

  const context = await port.getRoundContext(request.contestId);
  if (context.status !== 'active') {
    throw new Error('Grid contest session round requires an active contest');
  }
  if (context.attackerPlayerId !== request.attackerPlayerId) {
    throw new Error('Grid contest session round requires the contest attacker');
  }

  const attackerDice = signalDiceForCommit(
    context.attackerRemainingInfluence,
    config.attacker,
  );
  const defenderDice = signalDiceForCommit(
    context.defenderRemainingInfluence,
    config.defender,
  );
  if (attackerDice === 0) {
    throw new Error('Grid contest attacker no longer has enough Influence to continue');
  }
  if (defenderDice === 0) {
    throw new Error('Grid contest defender no longer has enough Influence to continue');
  }

  return port.resolveRound({
    contestId: request.contestId,
    attackerPlayerId: request.attackerPlayerId,
    attackerRolls: rollMany(roller, attackerDice, config.dieSides),
    defenderRolls: rollMany(roller, defenderDice, config.dieSides),
    idempotencyKey: request.idempotencyKey,
    now: request.now,
  });
}
