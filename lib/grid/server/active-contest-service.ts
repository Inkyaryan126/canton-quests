import type {
  GridActiveContest,
  GridActiveContestPort,
  GridActiveContestQuery,
} from './active-contest-port';

function requireNonBlank(value: string | undefined, label: string): void {
  if (value !== undefined && !value.trim()) {
    throw new Error(`Grid active contest discovery requires ${label}`);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: string | undefined, label: string): void {
  if (value !== undefined && value.trim() && !UUID_RE.test(value)) {
    throw new Error(`Grid active contest discovery requires valid ${label}`);
  }
}

export async function listGridActiveContests(
  port: GridActiveContestPort,
  query: GridActiveContestQuery,
): Promise<GridActiveContest[]> {
  requireNonBlank(query.seasonId, 'seasonId');
  requireNonBlank(query.playerId, 'playerId');
  requireNonBlank(query.territoryId, 'territoryId');
  requireNonBlank(query.viewerPlayerId, 'viewerPlayerId');
  requireUuid(query.seasonId, 'seasonId');
  requireUuid(query.playerId, 'playerId');
  requireUuid(query.territoryId, 'territoryId');
  requireUuid(query.viewerPlayerId, 'viewerPlayerId');
  if (query.playerId && query.viewerPlayerId && query.playerId !== query.viewerPlayerId) {
    throw new Error('Grid active contest discovery cannot query another player');
  }

  const rows = await port.listActiveContests(query);
  return [...rows].sort((a, b) => {
    const byStartedAt = Date.parse(b.startedAt) - Date.parse(a.startedAt);
    if (byStartedAt !== 0) return byStartedAt;
    return a.contestId.localeCompare(b.contestId);
  });
}
