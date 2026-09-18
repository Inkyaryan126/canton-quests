import type { GridPassportProjection } from '../core/passport-types';
import type { GridPassportReadPort } from './passport-read-port';

export type GridPassportCacheState = 'missing' | 'ready' | 'invalid';

export interface GridPassportReadResult {
  cacheState: GridPassportCacheState;
  passport: GridPassportProjection | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isProjection(value: unknown): value is GridPassportProjection {
  if (!isObject(value)) return false;

  return (
    value.version === 1 &&
    (value.homeCitySlug === null || typeof value.homeCitySlug === 'string') &&
    Array.isArray(value.citiesEntered) &&
    Array.isArray(value.cityRanks) &&
    Array.isArray(value.championships) &&
    (value.peakRank === null ||
      (Number.isSafeInteger(value.peakRank) && Number(value.peakRank) > 0)) &&
    Number.isSafeInteger(value.lifetimeTerritoriesControlled) &&
    Number(value.lifetimeTerritoriesControlled) >= 0 &&
    Array.isArray(value.landmarkAchievements) &&
    Array.isArray(value.allianceChampionships) &&
    Array.isArray(value.seasonalTrophies) &&
    Array.isArray(value.rareCosmetics) &&
    Number.isSafeInteger(value.nationalReputation) &&
    Number(value.nationalReputation) >= 0 &&
    Number.isSafeInteger(value.processedEventCount) &&
    Number(value.processedEventCount) >= 0 &&
    (value.lastUpdatedAt === null || typeof value.lastUpdatedAt === 'string')
  );
}

export async function readGridPassport(
  port: GridPassportReadPort,
  playerId: string,
): Promise<GridPassportReadResult> {
  const normalizedPlayerId = playerId.trim();
  if (!normalizedPlayerId) {
    throw new Error('Grid Passport read requires playerId');
  }

  const row = await port.readCache(normalizedPlayerId);
  if (!row) {
    return { cacheState: 'missing', passport: null };
  }

  if (
    !Number.isSafeInteger(row.globalReputation) ||
    row.globalReputation < 0 ||
    !isProjection(row.passport) ||
    row.passport.nationalReputation !== row.globalReputation
  ) {
    return { cacheState: 'invalid', passport: null };
  }

  return { cacheState: 'ready', passport: row.passport };
}
