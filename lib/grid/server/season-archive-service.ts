import { projectGridCityPower, validateGridCityPowerConfig } from '../core/city-power';
import type { GridCityPowerConfig } from '../core/city-power-types';
import type { GridProgressionSnapshot } from '../core/progression-types';
import type { GridPassportPersistencePort } from './passport-port';
import { rebuildGridPassport } from './passport-service';
import type {
  GridSeasonArchiveCandidate,
  GridSeasonArchiveCommitResult,
  GridSeasonArchivePort,
  GridSeasonFinalStanding,
} from './season-archive-port';

export interface ArchiveGridSeasonRequest {
  citySlug: string;
  seasonSlug: string;
  cityPowerConfig: GridCityPowerConfig;
  idempotencyKey: string;
  now: string;
}

export interface ArchiveGridSeasonResult {
  archive: GridSeasonArchiveCommitResult;
  standings: GridSeasonFinalStanding[];
  passportRebuiltCount: number;
  passportRebuildFailedPlayerIds: string[];
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid season archive requires ${label}`);
  return normalized;
}

function validTime(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Grid season archive requires valid ${label}`);
  }
  return parsed;
}

function metricFor(
  snapshot: GridProgressionSnapshot,
  componentId: string,
): number {
  if (!(componentId in snapshot.stats)) {
    throw new Error(
      `Grid season archive City Power metric ${componentId} is not backed by progression`,
    );
  }
  const value = snapshot.stats[
    componentId as keyof GridProgressionSnapshot['stats']
  ];
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `Grid season archive City Power metric ${componentId} is invalid`,
    );
  }
  return value;
}

export function buildGridSeasonFinalStandings(
  candidates: readonly GridSeasonArchiveCandidate[],
  config: GridCityPowerConfig,
): GridSeasonFinalStanding[] {
  validateGridCityPowerConfig(config);

  const seen = new Set<string>();
  const scored = candidates.map((candidate) => {
    const playerId = required(candidate.playerId, 'candidate playerId');
    if (seen.has(playerId)) {
      throw new Error(`Grid season archive duplicate player: ${playerId}`);
    }
    seen.add(playerId);

    const metrics = Object.fromEntries(
      config.components.map((component) => [
        component.id,
        metricFor(candidate.snapshot, component.id),
      ]),
    );
    const power = projectGridCityPower(metrics, config);
    return { candidate, playerId, power };
  });

  scored.sort((left, right) => {
    const power =
      right.power.cityPowerBps - left.power.cityPowerBps;
    if (power !== 0) return power;

    const rating =
      right.candidate.snapshot.gridRating -
      left.candidate.snapshot.gridRating;
    if (rating !== 0) return rating;

    const xp =
      right.candidate.snapshot.totalXp -
      left.candidate.snapshot.totalXp;
    if (xp !== 0) return xp;

    return left.playerId.localeCompare(right.playerId);
  });

  return scored.map(({ candidate, playerId, power }, index) => ({
    playerId,
    finalRank: index + 1,
    cityPowerBps: power.cityPowerBps,
    gridRating: candidate.snapshot.gridRating,
    totalXp: candidate.snapshot.totalXp,
    cityPowerBreakdown: power.breakdown,
  }));
}

async function rebuildPassports(
  passportPort: GridPassportPersistencePort,
  playerIds: readonly string[],
  rebuiltAt: string,
): Promise<{
  rebuiltCount: number;
  failedPlayerIds: string[];
}> {
  let rebuiltCount = 0;
  const failedPlayerIds: string[] = [];

  for (const playerId of playerIds) {
    try {
      await rebuildGridPassport(passportPort, playerId, rebuiltAt);
      rebuiltCount += 1;
    } catch {
      failedPlayerIds.push(playerId);
    }
  }

  return { rebuiltCount, failedPlayerIds };
}

export async function archiveGridSeason(
  archivePort: GridSeasonArchivePort,
  passportPort: GridPassportPersistencePort,
  request: ArchiveGridSeasonRequest,
): Promise<ArchiveGridSeasonResult> {
  const citySlug = required(request.citySlug, 'citySlug');
  const seasonSlug = required(request.seasonSlug, 'seasonSlug');
  const idempotencyKey = required(
    request.idempotencyKey,
    'a non-empty idempotency key',
  );
  const nowMs = validTime(request.now, 'now timestamp');
  validateGridCityPowerConfig(request.cityPowerConfig);

  const scope = await archivePort.resolveScope(citySlug, seasonSlug);
  if (!scope) {
    throw new Error('Grid season archive could not resolve the requested season');
  }
  if (
    scope.citySlug !== citySlug ||
    scope.seasonSlug !== seasonSlug
  ) {
    throw new Error('Grid season archive scope mismatch');
  }
  if (
    !['active', 'surge', 'complete', 'archived'].includes(scope.seasonStatus)
  ) {
    throw new Error(
      `Grid season archive cannot close season status ${scope.seasonStatus}`,
    );
  }
  if (!scope.endsAt) {
    throw new Error('Grid season archive requires a configured season end time');
  }
  const endsAtMs = validTime(scope.endsAt, 'season endsAt');
  if (nowMs < endsAtMs) {
    throw new Error('Grid season archive cannot run before the season ends');
  }

  const candidates = await archivePort.listCandidates(scope.seasonId);
  const standings = buildGridSeasonFinalStandings(
    candidates,
    request.cityPowerConfig,
  );

  const archive = await archivePort.archiveSeason({
    seasonId: scope.seasonId,
    standings,
    idempotencyKey,
    now: request.now,
  });

  const passportResult = await rebuildPassports(
    passportPort,
    standings.map((standing) => standing.playerId),
    request.now,
  );

  return {
    archive,
    standings,
    passportRebuiltCount: passportResult.rebuiltCount,
    passportRebuildFailedPlayerIds: passportResult.failedPlayerIds,
  };
}
