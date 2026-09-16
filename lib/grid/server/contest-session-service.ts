import type {
  GridContestSessionPort,
  GridStartContestCommand,
  GridStartContestResult,
  GridWithdrawContestCommand,
  GridWithdrawContestResult,
} from './contest-session-port';

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Grid contest session requires ${label}`);
  }
}

function requireTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid contest session requires a valid now timestamp');
  }
}

function requirePositiveInfluence(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Grid contest session requires positive integer ${label}`);
  }
}

export async function startGridContest(
  port: GridContestSessionPort,
  command: GridStartContestCommand,
): Promise<GridStartContestResult> {
  requireNonBlank(command.seasonId, 'seasonId');
  requireNonBlank(command.attackerPlayerId, 'attackerPlayerId');
  requireNonBlank(command.defenderPlayerId, 'defenderPlayerId');
  requireNonBlank(command.sourceTerritoryId, 'sourceTerritoryId');
  requireNonBlank(command.targetTerritoryId, 'targetTerritoryId');
  requireNonBlank(command.idempotencyKey, 'a non-empty idempotency key');
  requireTimestamp(command.now);

  if (command.attackerPlayerId === command.defenderPlayerId) {
    throw new Error('Grid contest session attacker and defender must differ');
  }
  if (command.sourceTerritoryId === command.targetTerritoryId) {
    throw new Error('Grid contest session source and target territories must differ');
  }

  requirePositiveInfluence(
    command.attackerCommittedInfluence,
    'attackerCommittedInfluence',
  );
  requirePositiveInfluence(
    command.defenderCommittedInfluence,
    'defenderCommittedInfluence',
  );

  return port.startContest(command);
}

export async function withdrawGridContest(
  port: GridContestSessionPort,
  command: GridWithdrawContestCommand,
): Promise<GridWithdrawContestResult> {
  requireNonBlank(command.contestId, 'contestId');
  requireNonBlank(command.attackerPlayerId, 'attackerPlayerId');
  requireNonBlank(command.idempotencyKey, 'a non-empty idempotency key');
  requireTimestamp(command.now);

  return port.withdrawContest(command);
}
