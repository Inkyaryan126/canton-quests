import type { GridCityPowerBreakdown } from '../core/city-power-types';
import type { GridProgressionSnapshot } from '../core/progression-types';

export interface GridSeasonArchiveScope {
  cityId: string;
  citySlug: string;
  seasonId: string;
  seasonSlug: string;
  seasonName: string;
  seasonStatus: string;
  endsAt: string | null;
}

export interface GridSeasonArchiveCandidate {
  playerId: string;
  snapshot: GridProgressionSnapshot;
}

export interface GridSeasonFinalStanding {
  playerId: string;
  finalRank: number;
  cityPowerBps: number;
  gridRating: number;
  totalXp: number;
  cityPowerBreakdown: GridCityPowerBreakdown[];
}

export interface GridSeasonArchiveCommand {
  seasonId: string;
  standings: GridSeasonFinalStanding[];
  idempotencyKey: string;
  now: string;
}

export interface GridSeasonArchiveCommitResult {
  seasonId: string;
  cityId: string;
  status: 'archived';
  archivedAt: string;
  standingsCount: number;
  championPlayerId: string | null;
  eventId: string;
}

export interface GridSeasonArchivePort {
  resolveScope(
    citySlug: string,
    seasonSlug: string,
  ): Promise<GridSeasonArchiveScope | null>;
  listCandidates(seasonId: string): Promise<GridSeasonArchiveCandidate[]>;
  archiveSeason(
    command: GridSeasonArchiveCommand,
  ): Promise<GridSeasonArchiveCommitResult>;
}
