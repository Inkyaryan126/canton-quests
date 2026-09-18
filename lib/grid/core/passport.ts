import type {
  GridPassportCityEntry,
  GridPassportCityStamp,
  GridPassportHistory,
} from './passport-types';

function requireIdentifier(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Grid Passport requires ${label}`);
  return trimmed;
}

function requireTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error('Grid Passport entry requires a valid enteredAt timestamp');
  }
  return timestamp;
}

export function projectGridPassportHistory(
  homeCityId: string | null,
  entries: readonly GridPassportCityEntry[],
): GridPassportHistory {
  const normalizedHomeCityId =
    homeCityId === null ? null : requireIdentifier(homeCityId, 'a non-empty homeCityId');

  const normalized = entries.map((entry) => ({
    cityId: requireIdentifier(entry.cityId, 'a non-empty cityId'),
    enteredAt: entry.enteredAt,
    enteredAtMs: requireTimestamp(entry.enteredAt),
  }));

  normalized.sort((a, b) => {
    if (a.enteredAtMs !== b.enteredAtMs) return a.enteredAtMs - b.enteredAtMs;
    return a.cityId.localeCompare(b.cityId);
  });

  const stampsByCity = new Map<string, GridPassportCityStamp>();
  for (const entry of normalized) {
    const existing = stampsByCity.get(entry.cityId);
    if (!existing) {
      stampsByCity.set(entry.cityId, {
        cityId: entry.cityId,
        firstEnteredAt: entry.enteredAt,
        lastEnteredAt: entry.enteredAt,
        entryCount: 1,
        isHomeCity: entry.cityId === normalizedHomeCityId,
      });
      continue;
    }

    existing.lastEnteredAt = entry.enteredAt;
    existing.entryCount += 1;
  }

  return {
    version: 1,
    homeCityId: normalizedHomeCityId,
    citiesEntered: stampsByCity.size,
    entriesRecorded: normalized.length,
    stamps: [...stampsByCity.values()],
  };
}
