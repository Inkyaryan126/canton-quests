import type { GridProgressionSnapshot } from '../core/progression-types';

export interface GridProgressionLeaderboardEntry {
  playerId: string;
  gridRating: number;
  level: number;
  primaryTitle: string | null;
  snapshot: GridProgressionSnapshot;
}

export interface GridProgressionReadPort {
  getSeasonPlayer(seasonId: string, playerId: string): Promise<GridProgressionSnapshot | null>;
  getLifetimePlayer(playerId: string): Promise<GridProgressionSnapshot | null>;
  getSeasonLeaderboard(seasonId: string, limit?: number): Promise<GridProgressionLeaderboardEntry[]>;
}
