export type GridReturnViewerRole =
  | 'attacker'
  | 'defender'
  | 'actor'
  | 'none';

export type GridReturnContestOutcome =
  | 'active'
  | 'captured'
  | 'defended'
  | 'withdrawn'
  | 'cancelled'
  | null;

export interface GridReturnSummaryContext {
  cityId: string;
  seasonId: string;
  lastActiveAt: string;
}

export interface GridReturnActivityEvent {
  eventType: string;
  entityType: string | null;
  createdAt: string;
  viewerRole: GridReturnViewerRole;
  contestOutcome: GridReturnContestOutcome;
}

export interface GridReturnActivityBatch {
  events: GridReturnActivityEvent[];
  truncated: boolean;
}

export interface GridReturnSummaryPort {
  getContext(playerId: string): Promise<GridReturnSummaryContext | null>;
  listActivity(
    seasonId: string,
    playerId: string,
    since: string,
    limit: number,
  ): Promise<GridReturnActivityBatch>;
}
