import type {
  GridPveStrongholdReadContext,
  GridPveStrongholdReadPort,
} from './pve-stronghold-read-port';

export interface GridPveStrongholdContestView {
  contestId: string;
  strongholdId: string;
  factionId: string;
  sourceTerritorySlug: string;
  targetTerritorySlug: string;
  objectiveKind: 'pve-territory' | 'pve-landmark';
  landmarkSlug: string | null;
  attackerCommittedInfluence: number;
  garrisonCommittedInfluence: number;
  attackerRemainingInfluence: number;
  garrisonRemainingInfluence: number;
  roundNumber: number;
  status: GridPveStrongholdReadContext['status'];
  startedAt: string;
  endedAt: string | null;
}

export type GridPveStrongholdReadErrorCode = 'INVALID_REQUEST' | 'NOT_FOUND';

export class GridPveStrongholdReadError extends Error {
  constructor(
    public readonly code: GridPveStrongholdReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GridPveStrongholdReadError';
  }
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new GridPveStrongholdReadError(
      'INVALID_REQUEST',
      `Grid PvE stronghold read requires ${field}`,
    );
  }
  return normalized;
}

function toView(row: GridPveStrongholdReadContext): GridPveStrongholdContestView {
  return {
    contestId: row.contestId,
    strongholdId: row.strongholdId,
    factionId: row.factionId,
    sourceTerritorySlug: row.sourceTerritorySlug,
    targetTerritorySlug: row.targetTerritorySlug,
    objectiveKind: row.objectiveKind,
    landmarkSlug: row.landmarkSlug,
    attackerCommittedInfluence: row.attackerCommittedInfluence,
    garrisonCommittedInfluence: row.garrisonCommittedInfluence,
    attackerRemainingInfluence: row.attackerRemainingInfluence,
    garrisonRemainingInfluence: row.garrisonRemainingInfluence,
    roundNumber: row.roundNumber,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  };
}

export async function listGridPveStrongholdContestsForPlayer(
  port: GridPveStrongholdReadPort,
  playerId: string,
): Promise<GridPveStrongholdContestView[]> {
  const normalizedPlayerId = requireText(playerId, 'playerId');
  const rows = await port.listActiveForPlayer(normalizedPlayerId);
  for (const row of rows) {
    if (row.attackerPlayerId !== normalizedPlayerId) {
      throw new Error('Grid PvE stronghold read returned another player contest');
    }
    if (row.status !== 'active') {
      throw new Error('Grid PvE stronghold active read returned a resolved contest');
    }
  }
  return [...rows]
    .sort((left, right) => {
      const byStarted = Date.parse(right.startedAt) - Date.parse(left.startedAt);
      if (byStarted !== 0) return byStarted;
      return left.contestId.localeCompare(right.contestId);
    })
    .map(toView);
}

export async function getGridPveStrongholdContestForPlayer(
  port: GridPveStrongholdReadPort,
  input: { contestId: string; viewerPlayerId: string },
): Promise<GridPveStrongholdContestView> {
  const contestId = requireText(input.contestId, 'contestId');
  const viewerPlayerId = requireText(input.viewerPlayerId, 'viewerPlayerId');
  const row = await port.getById(contestId);
  if (!row || row.attackerPlayerId !== viewerPlayerId) {
    throw new GridPveStrongholdReadError(
      'NOT_FOUND',
      'Grid PvE stronghold contest was not found',
    );
  }
  return toView(row);
}
