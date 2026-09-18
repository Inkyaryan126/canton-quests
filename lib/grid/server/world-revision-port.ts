export interface GridWorldRevisionState {
  seasonId: string;
  seasonStatus: string;
  seasonUpdatedAt: string;
  latestEventId: string | null;
  latestEventAt: string | null;
}

export interface GridWorldRevisionPort {
  readRevisionState(
    citySlug: string,
    seasonSlug: string,
  ): Promise<GridWorldRevisionState | null>;
}
