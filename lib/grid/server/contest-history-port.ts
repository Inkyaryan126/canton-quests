import type { GridContestSessionStatus } from './contest-session-port';

export const GRID_CONTEST_HISTORY_EVENT_TYPES = [
  'grid:contest_started',
  'grid:contest_session_round_resolved',
  'grid:contest_withdrawn',
] as const;

export type GridContestHistoryEventType =
  (typeof GRID_CONTEST_HISTORY_EVENT_TYPES)[number];

export interface GridContestHistoryContext {
  contestId: string;
  seasonId: string;
  cityId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  attackerRemainingInfluence: number;
  defenderRemainingInfluence: number;
  roundNumber: number;
  status: GridContestSessionStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface GridContestHistoryEvent {
  eventId: string;
  actorPlayerId: string | null;
  eventType: GridContestHistoryEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface GridContestHistoryPort {
  getContestContext(
    contestId: string,
  ): Promise<GridContestHistoryContext | null>;
  listContestEvents(
    contestId: string,
    seasonId: string,
  ): Promise<GridContestHistoryEvent[]>;
}
