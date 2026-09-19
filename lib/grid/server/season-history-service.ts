import type {
  GridSeasonHistoryPort,
  GridSeasonHistoryStandingRecord,
} from './season-history-port';

export interface GridPublicSeasonHistoryEntry {
  rank: number;
  callsign: string;
  avatarUrl: string | null;
  cityPower: number;
  gridRating: number;
  totalXp: number;
  champion: boolean;
}

export interface GridPublicSeasonHistory {
  archive: {
    citySlug: string;
    seasonSlug: string;
    seasonName: string;
    archivedAt: string;
    standingsCount: number;
    championCallsign: string | null;
  } | null;
  entries: GridPublicSeasonHistoryEntry[];
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid season history requires ${label}`);
  return normalized;
}

function validTimestamp(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`Grid season history requires valid ${label}`);
  }
  return value;
}

function validateStanding(
  standing: GridSeasonHistoryStandingRecord,
  expectedRank: number,
): void {
  required(standing.playerId, 'standing playerId');
  if (standing.finalRank !== expectedRank) {
    throw new Error('Grid season history final ranks are not contiguous');
  }
  if (
    !Number.isSafeInteger(standing.cityPowerBps) ||
    standing.cityPowerBps < 0 ||
    standing.cityPowerBps > 10_000
  ) {
    throw new Error('Grid season history City Power is invalid');
  }
  if (
    !Number.isSafeInteger(standing.gridRating) ||
    standing.gridRating < 0 ||
    standing.gridRating > 10_000
  ) {
    throw new Error('Grid season history Grid Rating is invalid');
  }
  if (!Number.isSafeInteger(standing.totalXp) || standing.totalXp < 0) {
    throw new Error('Grid season history XP is invalid');
  }
}

export async function readPublicGridSeasonHistory(
  port: GridSeasonHistoryPort,
  citySlugInput: string,
  seasonSlugInput: string,
): Promise<GridPublicSeasonHistory> {
  const citySlug = required(citySlugInput, 'citySlug');
  const seasonSlug = required(seasonSlugInput, 'seasonSlug');
  const archive = await port.readArchive(citySlug, seasonSlug);

  if (!archive) return { archive: null, entries: [] };

  if (
    archive.citySlug.trim() !== citySlug ||
    archive.seasonSlug.trim() !== seasonSlug
  ) {
    throw new Error('Grid season history archive scope mismatch');
  }

  required(archive.seasonId, 'archive seasonId');
  required(archive.seasonName, 'archive seasonName');
  validTimestamp(archive.archivedAt, 'archivedAt');
  if (
    !Number.isSafeInteger(archive.standingsCount) ||
    archive.standingsCount < 0
  ) {
    throw new Error('Grid season history standings count is invalid');
  }

  const standings = await port.readStandings(archive.seasonId);
  const sorted = [...standings].sort(
    (left, right) => left.finalRank - right.finalRank,
  );
  if (sorted.length !== archive.standingsCount) {
    throw new Error('Grid season history standings count mismatch');
  }

  const seenPlayers = new Set<string>();
  sorted.forEach((standing, index) => {
    validateStanding(standing, index + 1);
    if (seenPlayers.has(standing.playerId)) {
      throw new Error('Grid season history contains a duplicate player');
    }
    seenPlayers.add(standing.playerId);
  });

  const profiles = await port.readProfiles(
    sorted.map((standing) => standing.playerId),
  );
  const profileByPlayer = new Map(
    profiles.map((profile) => [profile.playerId, profile] as const),
  );

  const entries = sorted.map((standing) => {
    const profile = profileByPlayer.get(standing.playerId);
    const callsign =
      profile?.callsign.trim() || `Player #${standing.finalRank}`;
    return {
      rank: standing.finalRank,
      callsign,
      avatarUrl: profile?.avatarUrl ?? null,
      cityPower: standing.cityPowerBps,
      gridRating: standing.gridRating,
      totalXp: standing.totalXp,
      champion: standing.playerId === archive.championPlayerId,
    };
  });

  const champion = entries.find((entry) => entry.champion) ?? null;
  if (entries.length > 0 && !champion) {
    throw new Error('Grid season history champion is missing from standings');
  }
  if (entries.length === 0 && archive.championPlayerId !== null) {
    throw new Error('Grid season history empty archive cannot have a champion');
  }

  return {
    archive: {
      citySlug,
      seasonSlug,
      seasonName: archive.seasonName.trim(),
      archivedAt: archive.archivedAt,
      standingsCount: archive.standingsCount,
      championCallsign: champion?.callsign ?? null,
    },
    entries,
  };
}
