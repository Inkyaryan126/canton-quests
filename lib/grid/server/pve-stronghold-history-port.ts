export const GRID_PVE_STRONGHOLD_HISTORY_EVENT_TYPES = [
  'grid:pve_stronghold_contest_started',
  'grid:pve_stronghold_round_resolved',
  'grid:pve_stronghold_contest_withdrawn',
] as const;

export type GridPveStrongholdHistoryEventType =
  (typeof GRID_PVE_STRONGHOLD_HISTORY_EVENT_TYPES)[number];

export interface GridPveStrongholdHistoryContext {
  contestId: string;
  seasonId: string;
  attackerPlayerId: string;
}

export interface GridPveStrongholdHistoryEvent {
  eventId: string;
  eventType: GridPveStrongholdHistoryEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface GridPveStrongholdHistoryPort {
  getContestContext(contestId: string): Promise<GridPveStrongholdHistoryContext | null>;
  listContestEvents(
    contestId: string,
    seasonId: string,
  ): Promise<GridPveStrongholdHistoryEvent[]>;
}
