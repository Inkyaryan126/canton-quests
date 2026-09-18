import {
  GRID_CATEGORY_WEIGHTS,
  GRID_STAT_DEFINITIONS,
} from '../core/progression';
import {
  rankGridProgression,
  type GridProgressionRankingBoard,
} from '../core/progression-ranking';
import type {
  GridStatCategory,
  GridStatKey,
} from '../core/progression-types';
import type { GridProgressionLeaderboardDataPort } from './progression-leaderboard-port';

export interface GridPublicProgressionLeaderboardEntry {
  rank: number;
  callsign: string;
  avatarUrl: string | null;
  score: number;
  gridRating: number;
  level: number;
  totalXp: number;
  primaryTitle: string | null;
}

export interface GridPublicProgressionLeaderboard {
  board: GridProgressionRankingBoard;
  entries: GridPublicProgressionLeaderboardEntry[];
}

const CATEGORIES = new Set(
  Object.keys(GRID_CATEGORY_WEIGHTS) as GridStatCategory[],
);
const RANKING_STAT_KEYS = new Set(
  GRID_STAT_DEFINITIONS
    .filter((definition) => definition.rankingEnabled)
    .map((definition) => definition.key),
);
const ALL_STAT_KEYS = new Set(GRID_STAT_DEFINITIONS.map((definition) => definition.key));

export function parsePublicGridProgressionBoard(
  boardValue: string | null,
  statValue: string | null,
): GridProgressionRankingBoard {
  const board = boardValue?.trim() || 'overall';
  if (board === 'overall') return { type: 'overall' };

  if (CATEGORIES.has(board as GridStatCategory)) {
    return { type: 'category', category: board as GridStatCategory };
  }

  if (board === 'stat') {
    const stat = statValue?.trim() as GridStatKey | undefined;
    if (!stat || !ALL_STAT_KEYS.has(stat)) {
      throw new Error('Unknown Grid leaderboard stat');
    }
    if (!RANKING_STAT_KEYS.has(stat)) {
      throw new Error(`Grid stat ${stat} is not ranking-enabled`);
    }
    return { type: 'stat', stat };
  }

  throw new Error(`Unknown Grid leaderboard board: ${board}`);
}

export async function buildPublicGridProgressionLeaderboard(
  port: GridProgressionLeaderboardDataPort,
  input: {
    seasonId: string;
    board: GridProgressionRankingBoard;
    limit?: number;
  },
): Promise<GridPublicProgressionLeaderboard> {
  const candidates = await port.getSeasonCandidates(input.seasonId);
  const profiles = await port.getPublicProfiles(
    candidates.map((candidate) => candidate.playerId),
  );
  const profileByPlayerId = new Map(
    profiles
      .filter((profile) => profile.callsign.trim().length > 0)
      .map((profile) => [profile.playerId, profile] as const),
  );

  const publicCandidates = candidates.filter((candidate) =>
    profileByPlayerId.has(candidate.playerId),
  );
  const ranked = rankGridProgression(publicCandidates, input.board);
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 25)));

  return {
    board: input.board,
    entries: ranked.slice(0, limit).map((entry) => {
      const profile = profileByPlayerId.get(entry.playerId)!;
      return {
        rank: entry.rank,
        callsign: profile.callsign.trim(),
        avatarUrl: profile.avatarUrl,
        score: entry.score,
        gridRating: entry.snapshot.gridRating,
        level: entry.snapshot.level,
        totalXp: entry.snapshot.totalXp,
        primaryTitle: entry.snapshot.primaryTitle,
      };
    }),
  };
}
