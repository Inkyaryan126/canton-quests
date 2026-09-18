import {
  GRID_PASSPORT_VERSION,
  type GridPassportAchievement,
  type GridPassportCityRank,
  type GridPassportEvent,
  type GridPassportProjection,
} from './passport-types';

function nonBlank(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid Passport requires ${field}`);
  return normalized;
}

function validTimestamp(value: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Grid Passport requires a valid occurredAt timestamp');
  }
  return value;
}

function positiveSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Grid Passport requires ${field} to be a positive safe integer`);
  }
  return value;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

function fingerprint(event: GridPassportEvent): string {
  return JSON.stringify(stableValue(event));
}

function validateEvent(event: GridPassportEvent): void {
  nonBlank(event.id, 'event id');
  validTimestamp(event.occurredAt);

  switch (event.type) {
    case 'city-entered':
    case 'home-city-set':
      nonBlank(event.citySlug, 'city slug');
      return;
    case 'city-rank-recorded':
      nonBlank(event.citySlug, 'city slug');
      positiveSafeInteger(event.rank, 'rank');
      return;
    case 'championship-earned':
    case 'alliance-championship-earned':
    case 'seasonal-trophy-earned':
      nonBlank(event.citySlug, 'city slug');
      nonBlank(event.seasonSlug, 'season slug');
      nonBlank(event.achievementId, 'achievement id');
      nonBlank(event.label, 'achievement label');
      return;
    case 'territory-control-recorded':
      nonBlank(event.citySlug, 'city slug');
      nonBlank(event.seasonSlug, 'season slug');
      nonBlank(event.territorySlug, 'territory slug');
      return;
    case 'landmark-achievement-earned':
      nonBlank(event.citySlug, 'city slug');
      nonBlank(event.achievementId, 'achievement id');
      nonBlank(event.label, 'achievement label');
      return;
    case 'rare-cosmetic-earned':
      nonBlank(event.cosmeticId, 'cosmetic id');
      nonBlank(event.label, 'cosmetic label');
      return;
    case 'reputation-earned':
      positiveSafeInteger(event.amount, 'reputation amount');
      nonBlank(event.reason, 'reputation reason');
      if (event.citySlug !== undefined) nonBlank(event.citySlug, 'city slug');
      return;
  }
}

function achievement(
  event: Extract<
    GridPassportEvent,
    {
      type:
        | 'championship-earned'
        | 'landmark-achievement-earned'
        | 'alliance-championship-earned'
        | 'seasonal-trophy-earned';
    }
  >,
): GridPassportAchievement {
  return {
    achievementId: event.achievementId.trim(),
    label: event.label.trim(),
    citySlug: event.citySlug.trim(),
    seasonSlug: 'seasonSlug' in event ? event.seasonSlug.trim() : null,
    earnedAt: event.occurredAt,
  };
}

function safeAdd(current: number, amount: number): number {
  const next = current + amount;
  if (!Number.isSafeInteger(next)) {
    throw new Error('Grid Passport national reputation exceeds safe integer range');
  }
  return next;
}

export function emptyGridPassport(): GridPassportProjection {
  return {
    version: GRID_PASSPORT_VERSION,
    homeCitySlug: null,
    citiesEntered: [],
    cityRanks: [],
    championships: [],
    peakRank: null,
    lifetimeTerritoriesControlled: 0,
    landmarkAchievements: [],
    allianceChampionships: [],
    seasonalTrophies: [],
    rareCosmetics: [],
    nationalReputation: 0,
    processedEventCount: 0,
    lastUpdatedAt: null,
  };
}

export function projectGridPassport(
  events: readonly GridPassportEvent[],
): GridPassportProjection {
  const byId = new Map<string, GridPassportEvent>();
  const fingerprints = new Map<string, string>();

  for (const event of events) {
    validateEvent(event);
    const id = event.id.trim();
    const nextFingerprint = fingerprint(event);
    const existingFingerprint = fingerprints.get(id);

    if (existingFingerprint && existingFingerprint !== nextFingerprint) {
      throw new Error(`Grid Passport event id collision: ${id}`);
    }
    if (!existingFingerprint) {
      byId.set(id, event);
      fingerprints.set(id, nextFingerprint);
    }
  }

  const ordered = [...byId.values()].sort((left, right) => {
    const time = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
    return time || left.id.localeCompare(right.id);
  });

  const cityOrder: string[] = [];
  const seenCities = new Set<string>();
  const cityRanks = new Map<string, GridPassportCityRank>();
  const championships = new Map<string, GridPassportAchievement>();
  const landmarkAchievements = new Map<string, GridPassportAchievement>();
  const allianceChampionships = new Map<string, GridPassportAchievement>();
  const seasonalTrophies = new Map<string, GridPassportAchievement>();
  const rareCosmetics = new Map<
    string,
    GridPassportProjection['rareCosmetics'][number]
  >();
  const territoryControls = new Set<string>();

  let homeCitySlug: string | null = null;
  let nationalReputation = 0;
  let lastUpdatedAt: string | null = null;

  const recordCity = (citySlug: string) => {
    const normalized = citySlug.trim();
    if (!seenCities.has(normalized)) {
      seenCities.add(normalized);
      cityOrder.push(normalized);
    }
  };

  for (const event of ordered) {
    lastUpdatedAt = event.occurredAt;

    switch (event.type) {
      case 'city-entered':
        recordCity(event.citySlug);
        break;
      case 'home-city-set':
        recordCity(event.citySlug);
        homeCitySlug = event.citySlug.trim();
        break;
      case 'city-rank-recorded': {
        recordCity(event.citySlug);
        const citySlug = event.citySlug.trim();
        const previous = cityRanks.get(citySlug);
        cityRanks.set(citySlug, {
          citySlug,
          currentRank: event.rank,
          peakRank: previous ? Math.min(previous.peakRank, event.rank) : event.rank,
          updatedAt: event.occurredAt,
        });
        break;
      }
      case 'championship-earned': {
        recordCity(event.citySlug);
        const key = `${event.citySlug.trim()}:${event.seasonSlug.trim()}:${event.achievementId.trim()}`;
        if (!championships.has(key)) championships.set(key, achievement(event));
        break;
      }
      case 'territory-control-recorded':
        recordCity(event.citySlug);
        territoryControls.add(
          `${event.citySlug.trim()}:${event.seasonSlug.trim()}:${event.territorySlug.trim()}`,
        );
        break;
      case 'landmark-achievement-earned': {
        recordCity(event.citySlug);
        const key = `${event.citySlug.trim()}:${event.achievementId.trim()}`;
        if (!landmarkAchievements.has(key)) {
          landmarkAchievements.set(key, achievement(event));
        }
        break;
      }
      case 'alliance-championship-earned': {
        recordCity(event.citySlug);
        const key = `${event.citySlug.trim()}:${event.seasonSlug.trim()}:${event.achievementId.trim()}`;
        if (!allianceChampionships.has(key)) {
          allianceChampionships.set(key, achievement(event));
        }
        break;
      }
      case 'seasonal-trophy-earned': {
        recordCity(event.citySlug);
        const key = `${event.citySlug.trim()}:${event.seasonSlug.trim()}:${event.achievementId.trim()}`;
        if (!seasonalTrophies.has(key)) seasonalTrophies.set(key, achievement(event));
        break;
      }
      case 'rare-cosmetic-earned': {
        const key = event.cosmeticId.trim();
        if (!rareCosmetics.has(key)) {
          rareCosmetics.set(key, {
            cosmeticId: key,
            label: event.label.trim(),
            earnedAt: event.occurredAt,
          });
        }
        break;
      }
      case 'reputation-earned':
        if (event.citySlug) recordCity(event.citySlug);
        nationalReputation = safeAdd(nationalReputation, event.amount);
        break;
    }
  }

  const rankRecords = [...cityRanks.values()].sort((left, right) =>
    left.citySlug.localeCompare(right.citySlug),
  );

  return {
    version: GRID_PASSPORT_VERSION,
    homeCitySlug,
    citiesEntered: cityOrder,
    cityRanks: rankRecords,
    championships: [...championships.values()],
    peakRank:
      rankRecords.length > 0
        ? Math.min(...rankRecords.map((record) => record.peakRank))
        : null,
    lifetimeTerritoriesControlled: territoryControls.size,
    landmarkAchievements: [...landmarkAchievements.values()],
    allianceChampionships: [...allianceChampionships.values()],
    seasonalTrophies: [...seasonalTrophies.values()],
    rareCosmetics: [...rareCosmetics.values()],
    nationalReputation,
    processedEventCount: ordered.length,
    lastUpdatedAt,
  };
}
