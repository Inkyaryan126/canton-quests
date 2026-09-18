import type { GridProgressionSnapshot } from '../core/progression-types';

export interface GridProgressionLeaderboardCandidate {
  playerId: string;
  snapshot: GridProgressionSnapshot;
}

export interface GridPublicPlayerProfile {
  playerId: string;
  callsign: string;
  avatarUrl: string | null;
}

export interface GridProgressionLeaderboardDataPort {
  getSeasonCandidates(seasonId: string): Promise<GridProgressionLeaderboardCandidate[]>;
  getPublicProfiles(playerIds: string[]): Promise<GridPublicPlayerProfile[]>;
}
