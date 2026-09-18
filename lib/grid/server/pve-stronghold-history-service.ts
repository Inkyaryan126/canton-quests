import type {
  GridPveStrongholdHistoryEvent,
  GridPveStrongholdHistoryPort,
} from './pve-stronghold-history-port';

export type GridPveStrongholdHistoryErrorCode = 'INVALID_REQUEST' | 'NOT_FOUND';

export class GridPveStrongholdHistoryError extends Error {
  constructor(
    public readonly code: GridPveStrongholdHistoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GridPveStrongholdHistoryError';
  }
}

export type GridPveStrongholdHistoryViewEvent =
  | {
      kind: 'started';
      strongholdId: string;
      factionId: string;
      objectiveKind: 'pve-territory' | 'pve-landmark';
      landmarkSlug: string | null;
      attackerCommittedInfluence: number;
      garrisonCommittedInfluence: number;
      createdAt: string;
    }
  | {
      kind: 'round';
      strongholdId: string;
      roundNumber: number;
      status: 'active' | 'captured' | 'repelled';
      attackerRolls: number[];
      garrisonRolls: number[];
      comparisons: Array<{
        attackerRoll: number;
        garrisonRoll: number;
        winner: 'attacker' | 'garrison';
      }>;
      attackerInfluenceLost: number;
      garrisonInfluenceLost: number;
      attackerRemainingInfluence: number;
      garrisonRemainingInfluence: number;
      attackerRefundedInfluence: number;
      territoryCaptured: boolean;
      createdAt: string;
    }
  | {
      kind: 'withdrawn';
      strongholdId: string;
      attackerRefundedInfluence: number;
      garrisonRemainingInfluence: number;
      createdAt: string;
    };

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GridPveStrongholdHistoryError(
      'INVALID_REQUEST',
      `Grid PvE stronghold history requires ${field}`,
    );
  }
  return normalized;
}

function malformed(field: string): never {
  throw new Error(`Grid PvE stronghold history ledger event is malformed: ${field}`);
}

function stringField(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  return typeof value === 'string' && value.trim() ? value : malformed(field);
}

function nullableStringField(
  payload: Record<string, unknown>,
  field: string,
): string | null {
  const value = payload[field];
  if (value === null || value === undefined) return null;
  return typeof value === 'string' && value.trim() ? value : malformed(field);
}

function integerField(
  payload: Record<string, unknown>,
  field: string,
  minimum = 0,
): number {
  const value = payload[field];
  return Number.isSafeInteger(value) && (value as number) >= minimum
    ? (value as number)
    : malformed(field);
}

function booleanField(payload: Record<string, unknown>, field: string): boolean {
  const value = payload[field];
  return typeof value === 'boolean' ? value : malformed(field);
}

function rollsField(payload: Record<string, unknown>, field: string): number[] {
  const value = payload[field];
  if (!Array.isArray(value)) return malformed(field);
  return value.map((roll, index) =>
    Number.isSafeInteger(roll) && (roll as number) > 0
      ? (roll as number)
      : malformed(`${field}[${index}]`),
  );
}

function comparisonsField(payload: Record<string, unknown>) {
  const value = payload.comparisons;
  if (!Array.isArray(value)) return malformed('comparisons');
  return value.map((comparison, index) => {
    if (!comparison || typeof comparison !== 'object' || Array.isArray(comparison)) {
      return malformed(`comparisons[${index}]`);
    }
    const row = comparison as Record<string, unknown>;
    const attackerRoll = integerField(row, 'attackerRoll', 1);
    const garrisonRoll = integerField(row, 'defenderRoll', 1);
    const winner = row.winner;
    if (winner !== 'attacker' && winner !== 'defender') {
      return malformed(`comparisons[${index}].winner`);
    }
    return {
      attackerRoll,
      garrisonRoll,
      winner: winner === 'attacker' ? 'attacker' as const : 'garrison' as const,
    };
  });
}

function projectEvent(
  event: GridPveStrongholdHistoryEvent,
): GridPveStrongholdHistoryViewEvent {
  const payload = event.payload;
  if (event.eventType === 'grid:pve_stronghold_contest_started') {
    const objectiveKind = stringField(payload, 'objectiveKind');
    if (objectiveKind !== 'pve-territory' && objectiveKind !== 'pve-landmark') {
      return malformed('objectiveKind');
    }
    return {
      kind: 'started',
      strongholdId: stringField(payload, 'strongholdId'),
      factionId: stringField(payload, 'factionId'),
      objectiveKind,
      landmarkSlug: nullableStringField(payload, 'landmarkSlug'),
      attackerCommittedInfluence: integerField(payload, 'attackerCommittedInfluence', 1),
      garrisonCommittedInfluence: integerField(payload, 'garrisonCommittedInfluence', 1),
      createdAt: event.createdAt,
    };
  }

  if (event.eventType === 'grid:pve_stronghold_round_resolved') {
    const status = stringField(payload, 'status');
    if (status !== 'active' && status !== 'captured' && status !== 'repelled') {
      return malformed('status');
    }
    return {
      kind: 'round',
      strongholdId: stringField(payload, 'strongholdId'),
      roundNumber: integerField(payload, 'roundNumber', 1),
      status,
      attackerRolls: rollsField(payload, 'attackerRolls'),
      garrisonRolls: rollsField(payload, 'garrisonRolls'),
      comparisons: comparisonsField(payload),
      attackerInfluenceLost: integerField(payload, 'attackerInfluenceLost'),
      garrisonInfluenceLost: integerField(payload, 'garrisonInfluenceLost'),
      attackerRemainingInfluence: integerField(payload, 'attackerRemainingInfluence'),
      garrisonRemainingInfluence: integerField(payload, 'garrisonRemainingInfluence'),
      attackerRefundedInfluence: integerField(payload, 'attackerRefundedInfluence'),
      territoryCaptured: booleanField(payload, 'territoryCaptured'),
      createdAt: event.createdAt,
    };
  }

  return {
    kind: 'withdrawn',
    strongholdId: stringField(payload, 'strongholdId'),
    attackerRefundedInfluence: integerField(payload, 'attackerRefundedInfluence'),
    garrisonRemainingInfluence: integerField(payload, 'garrisonRemainingInfluence'),
    createdAt: event.createdAt,
  };
}

export async function getGridPveStrongholdHistory(
  port: GridPveStrongholdHistoryPort,
  input: { contestId: string; viewerPlayerId: string },
): Promise<{ events: GridPveStrongholdHistoryViewEvent[] }> {
  const contestId = requireText(input.contestId, 'contestId');
  const viewerPlayerId = requireText(input.viewerPlayerId, 'viewerPlayerId');
  const contest = await port.getContestContext(contestId);
  if (!contest || contest.attackerPlayerId !== viewerPlayerId) {
    throw new GridPveStrongholdHistoryError(
      'NOT_FOUND',
      'Grid PvE stronghold history was not found',
    );
  }

  const events = await port.listContestEvents(contest.contestId, contest.seasonId);
  const ordered = [...events].sort((left, right) => {
    const byTime = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (byTime !== 0) return byTime;
    return left.eventId.localeCompare(right.eventId);
  });
  return { events: ordered.map(projectEvent) };
}
