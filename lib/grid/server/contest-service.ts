import type { GridContestConfig } from '../core/contest-types';
import { signalDiceForCommit } from '../core/contest';
import type {
  GridContestRoundCommandResult,
  GridContestRoundPort,
} from './contest-port';

export interface GridContestRoundRequest {
  seasonId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  idempotencyKey: string;
  now: string;
}

export interface GridSignalDiceRoller {
  roll(dieSides: number): number;
}

function requirePositiveInfluence(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Grid contest requires positive integer ${label}`);
  }
}

function validateRequest(request: GridContestRoundRequest): void {
  if (!request.idempotencyKey.trim()) {
    throw new Error('Grid contest requires a non-empty idempotency key');
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error('Grid contest requires a valid now timestamp');
  }

  const ids = [
    request.seasonId,
    request.attackerPlayerId,
    request.defenderPlayerId,
    request.sourceTerritoryId,
    request.targetTerritoryId,
  ];
  if (ids.some((value) => !value.trim())) {
    throw new Error('Grid contest requires season, player, and territory ids');
  }
  if (request.attackerPlayerId === request.defenderPlayerId) {
    throw new Error('Grid contest attacker and defender must differ');
  }
  if (request.sourceTerritoryId === request.targetTerritoryId) {
    throw new Error('Grid contest source and target territories must differ');
  }

  requirePositiveInfluence(
    request.attackerCommittedInfluence,
    'attackerCommittedInfluence',
  );
  requirePositiveInfluence(
    request.defenderCommittedInfluence,
    'defenderCommittedInfluence',
  );
}

function rollMany(
  roller: GridSignalDiceRoller,
  count: number,
  dieSides: number,
): number[] {
  return Array.from({ length: count }, () => {
    const roll = roller.roll(dieSides);
    if (!Number.isInteger(roll) || roll < 1 || roll > dieSides) {
      throw new Error(`Grid contest roller returned invalid d${dieSides} result: ${roll}`);
    }
    return roll;
  });
}

export async function resolveGridContestRound(
  port: GridContestRoundPort,
  roller: GridSignalDiceRoller,
  config: GridContestConfig,
  request: GridContestRoundRequest,
): Promise<GridContestRoundCommandResult> {
  validateRequest(request);

  const attackerDice = signalDiceForCommit(
    request.attackerCommittedInfluence,
    config.attacker,
  );
  const defenderDice = signalDiceForCommit(
    request.defenderCommittedInfluence,
    config.defender,
  );

  if (attackerDice === 0 || defenderDice === 0) {
    throw new Error('Grid contest committed Influence does not unlock Signal Dice');
  }

  return port.resolveRound({
    ...request,
    attackerRolls: rollMany(roller, attackerDice, config.dieSides),
    defenderRolls: rollMany(roller, defenderDice, config.dieSides),
  });
}
