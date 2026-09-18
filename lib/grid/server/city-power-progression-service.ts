import { projectGridCityPower, validateGridCityPowerConfig } from '../core/city-power';
import type {
  GridCityPowerConfig,
  GridCityPowerProjection,
} from '../core/city-power-types';
import { GRID_STAT_DEFINITIONS } from '../core/progression';
import type { GridProgressionSnapshot } from '../core/progression-types';
import type { GridProgressionLeaderboardDataPort } from './progression-leaderboard-port';

export interface GridPublicCityPowerEntry {
  rank: number;
  callsign: string;
  avatarUrl: string | null;
  score: number;
  gridRating: number;
  level: number;
  totalXp: number;
  primaryTitle: string | null;
}

export interface GridPublicCityPowerLeaderboard {
  board: { type: 'city-power' };
  entries: GridPublicCityPowerEntry[];
}

const PROGRESSION_STAT_KEYS = new Set(
  GRID_STAT_DEFINITIONS.map((definition) => definition.key),
);

function projectionForSnapshot(
  snapshot: GridProgressionSnapshot,
  config: GridCityPowerConfig,
): GridCityPowerProjection {
  const metrics: Record<string, number> = {};
  for (const component of config.components) {
    if (!PROGRESSION_STAT_KEYS.has(component.id as never)) {
      throw new Error(
        `Live City Power component ${component.id} is not backed by a Grid progression stat`,
      );
    }
    metrics[component.id] =
      snapshot.stats[
        component.id as keyof GridProgressionSnapshot['stats']
      ] ?? 0;
  }
  return projectGridCityPower(metrics, config);
}

function compareTuple(a: number[], b: number[]): number {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (b[index] ?? 0) - (a[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function sameTuple(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export async function buildPublicGridCityPowerLeaderboard(
  port: GridProgressionLeaderboardDataPort,
  input: {
    seasonId: string;
    config: GridCityPowerConfig;
    limit?: number;
  },
): Promise<GridPublicCityPowerLeaderboard> {
  if (!input.seasonId.trim()) {
    throw new Error('Grid City Power leaderboard requires seasonId');
  }
  validateGridCityPowerConfig(input.config);

  const candidates = await port.getSeasonCandidates(input.seasonId);
  const profiles = await port.getPublicProfiles(
    candidates.map((candidate) => candidate.playerId),
  );
  const profileByPlayerId = new Map(
    profiles
      .filter((profile) => profile.callsign.trim().length > 0)
      .map((profile) => [profile.playerId, profile] as const),
  );

  const scored = candidates
    .filter((candidate) => profileByPlayerId.has(candidate.playerId))
    .map((candidate) => {
      const cityPower = projectionForSnapshot(candidate.snapshot, input.config);
      return {
        candidate,
        cityPower,
        tuple: [
          cityPower.cityPowerBps,
          candidate.snapshot.gridRating,
          candidate.snapshot.totalXp,
        ],
      };
    });

  scored.sort((a, b) => {
    const tupleOrder = compareTuple(a.tuple, b.tuple);
    return tupleOrder !== 0
      ? tupleOrder
      : a.candidate.playerId.localeCompare(b.candidate.playerId);
  });

  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 25)));
  let previousTuple: number[] | null = null;
  let previousRank = 0;

  const ranked = scored.map((item, index) => {
    const rank =
      previousTuple && sameTuple(previousTuple, item.tuple)
        ? previousRank
        : index + 1;
    previousTuple = item.tuple;
    previousRank = rank;
    return { ...item, rank };
  });

  return {
    board: { type: 'city-power' },
    entries: ranked.slice(0, limit).map(({ candidate, cityPower, rank }) => {
      const profile = profileByPlayerId.get(candidate.playerId)!;
      return {
        rank,
        callsign: profile.callsign.trim(),
        avatarUrl: profile.avatarUrl,
        score: cityPower.cityPowerBps,
        gridRating: candidate.snapshot.gridRating,
        level: candidate.snapshot.level,
        totalXp: candidate.snapshot.totalXp,
        primaryTitle: candidate.snapshot.primaryTitle,
      };
    }),
  };
}
