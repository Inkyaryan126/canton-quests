import type {
  GridContestHistoryContext,
  GridContestHistoryEvent,
  GridContestHistoryPort,
} from './contest-history-port';

export type GridContestHistoryViewerRole = 'attacker' | 'defender';

export type GridContestHistoryErrorCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'FORBIDDEN';

export class GridContestHistoryError extends Error {
  constructor(
    public readonly code: GridContestHistoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GridContestHistoryError';
  }
}

export interface GridContestHistoryRequest {
  contestId: string;
  viewerPlayerId: string;
}

export interface GridContestHistoryResult {
  contest: GridContestHistoryContext;
  viewerRole: GridContestHistoryViewerRole;
  events: GridContestHistoryEvent[];
}

function compareEvents(
  a: GridContestHistoryEvent,
  b: GridContestHistoryEvent,
): number {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (byTime !== 0) return byTime;
  return a.eventId.localeCompare(b.eventId);
}

export async function getGridContestHistory(
  port: GridContestHistoryPort,
  request: GridContestHistoryRequest,
): Promise<GridContestHistoryResult> {
  if (!request.contestId.trim() || !request.viewerPlayerId.trim()) {
    throw new GridContestHistoryError(
      'INVALID_REQUEST',
      'Grid contest history requires contestId and viewerPlayerId',
    );
  }

  const contest = await port.getContestContext(request.contestId);
  if (!contest) {
    throw new GridContestHistoryError(
      'NOT_FOUND',
      'Grid contest history was not found',
    );
  }

  const viewerRole =
    contest.attackerPlayerId === request.viewerPlayerId
      ? 'attacker'
      : contest.defenderPlayerId === request.viewerPlayerId
        ? 'defender'
        : null;

  if (!viewerRole) {
    throw new GridContestHistoryError(
      'FORBIDDEN',
      'Grid contest history is restricted to contest participants',
    );
  }

  const events = await port.listContestEvents(
    contest.contestId,
    contest.seasonId,
  );

  return {
    contest,
    viewerRole,
    events: [...events].sort(compareEvents),
  };
}
