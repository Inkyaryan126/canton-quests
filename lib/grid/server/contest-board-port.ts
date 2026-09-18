export interface GridContestBoardTerritoryIds {
  sourceTerritoryId: string;
  targetTerritoryId: string;
}

export interface GridContestBoardPort {
  resolveTerritoryIds(
    sourceTerritorySlug: string,
    targetTerritorySlug: string,
  ): Promise<GridContestBoardTerritoryIds | null>;
}
