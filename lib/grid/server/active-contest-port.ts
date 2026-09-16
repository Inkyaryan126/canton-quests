export interface GridActiveContest {
  contestId: string;
  seasonId: string;
  cityId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  attackerRemainingInfluence: number;
  defenderRemainingInfluence: number;
  roundNumber: number;
  startedAt: string;
}

export interface GridActiveContestQuery {
  seasonId: string;
  playerId?: string;
  viewerPlayerId?: string;
  territoryId?: string;
}

export interface GridActiveContestPort {
  listActiveContests(query: GridActiveContestQuery): Promise<GridActiveContest[]>;
}
