export interface GridSeasonHistoryArchiveRecord {
  seasonId: string;
  citySlug: string;
  seasonSlug: string;
  seasonName: string;
  archivedAt: string;
  championPlayerId: string | null;
  standingsCount: number;
}

export interface GridSeasonHistoryStandingRecord {
  playerId: string;
  finalRank: number;
  cityPowerBps: number;
  gridRating: number;
  totalXp: number;
}

export interface GridSeasonHistoryProfile {
  playerId: string;
  callsign: string;
  avatarUrl: string | null;
}

export interface GridSeasonHistoryPort {
  readArchive(
    citySlug: string,
    seasonSlug: string,
  ): Promise<GridSeasonHistoryArchiveRecord | null>;
  readStandings(seasonId: string): Promise<GridSeasonHistoryStandingRecord[]>;
  readProfiles(playerIds: string[]): Promise<GridSeasonHistoryProfile[]>;
}
