import type { GridPassportHistory } from '../core/passport-types';
import type {
  GridPassportCityLabel,
  GridPassportReadPort,
  GridPassportStoredProfile,
} from './passport-read-port';

export interface GridPassportView {
  homeCityId: string | null;
  globalReputation: number;
  history: GridPassportHistory;
  cities: GridPassportCityLabel[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Grid Passport stored ${label} is invalid`);
  }
  return value as number;
}

function parseHistory(profile: GridPassportStoredProfile): GridPassportHistory {
  const passport = record(profile.passport);
  if (!passport) throw new Error('Grid Passport stored state is invalid');
  if (Object.keys(passport).length === 0) {
    return {
      version: 1,
      homeCityId: profile.homeCityId,
      citiesEntered: 0,
      entriesRecorded: 0,
      stamps: [],
    };
  }

  if (passport.version !== 1) throw new Error('Grid Passport stored version is unsupported');
  if (passport.homeCityId !== profile.homeCityId) {
    throw new Error('Grid Passport stored Home City does not match canonical profile');
  }

  const citiesEntered = nonNegativeInteger(passport.citiesEntered, 'citiesEntered');
  const entriesRecorded = nonNegativeInteger(passport.entriesRecorded, 'entriesRecorded');
  if (!Array.isArray(passport.stamps)) throw new Error('Grid Passport stored stamps are invalid');

  const seen = new Set<string>();
  let entryTotal = 0;
  const stamps = passport.stamps.map((raw) => {
    const stamp = record(raw);
    if (!stamp || typeof stamp.cityId !== 'string' || !stamp.cityId.trim()) {
      throw new Error('Grid Passport stored stamp cityId is invalid');
    }
    if (seen.has(stamp.cityId)) throw new Error('Grid Passport stored stamps contain duplicate cities');
    seen.add(stamp.cityId);

    if (typeof stamp.firstEnteredAt !== 'string' || typeof stamp.lastEnteredAt !== 'string') {
      throw new Error('Grid Passport stored stamp timestamps are invalid');
    }
    const firstMs = Date.parse(stamp.firstEnteredAt);
    const lastMs = Date.parse(stamp.lastEnteredAt);
    if (!Number.isFinite(firstMs) || !Number.isFinite(lastMs) || firstMs > lastMs) {
      throw new Error('Grid Passport stored stamp timestamps are invalid');
    }

    const entryCount = nonNegativeInteger(stamp.entryCount, 'stamp entryCount');
    if (entryCount < 1) throw new Error('Grid Passport stored stamp entryCount is invalid');
    if (typeof stamp.isHomeCity !== 'boolean') {
      throw new Error('Grid Passport stored stamp Home City marker is invalid');
    }
    if (stamp.isHomeCity !== (stamp.cityId === profile.homeCityId)) {
      throw new Error('Grid Passport stored stamp Home City marker is inconsistent');
    }

    entryTotal += entryCount;
    return {
      cityId: stamp.cityId,
      firstEnteredAt: stamp.firstEnteredAt,
      lastEnteredAt: stamp.lastEnteredAt,
      entryCount,
      isHomeCity: stamp.isHomeCity,
    };
  });

  if (citiesEntered !== stamps.length || entriesRecorded !== entryTotal) {
    throw new Error('Grid Passport stored aggregate counts are inconsistent');
  }

  stamps.sort((a, b) => {
    const timeDelta = Date.parse(a.firstEnteredAt) - Date.parse(b.firstEnteredAt);
    return timeDelta !== 0 ? timeDelta : a.cityId.localeCompare(b.cityId);
  });

  return { version: 1, homeCityId: profile.homeCityId, citiesEntered, entriesRecorded, stamps };
}

export async function readGridPassport(
  port: GridPassportReadPort,
  playerId: string,
): Promise<GridPassportView | null> {
  if (!playerId.trim()) throw new Error('Grid Passport read requires playerId');
  const profile = await port.getProfile(playerId);
  if (!profile) return null;
  if (!Number.isSafeInteger(profile.globalReputation) || profile.globalReputation < 0) {
    throw new Error('Grid Passport stored global reputation is invalid');
  }

  const history = parseHistory(profile);
  const cityIds = [...new Set([
    ...(profile.homeCityId ? [profile.homeCityId] : []),
    ...history.stamps.map((stamp) => stamp.cityId),
  ])];
  const cityRows = cityIds.length > 0 ? await port.getCities(cityIds) : [];
  const requested = new Set(cityIds);
  const seen = new Set<string>();
  const cities = cityRows.map((city) => {
    if (!requested.has(city.cityId) || seen.has(city.cityId)) {
      throw new Error('Grid Passport city directory returned inconsistent results');
    }
    if (![city.cityId, city.slug, city.name, city.regionCode, city.countryCode].every((value) => value.trim())) {
      throw new Error('Grid Passport city directory returned invalid labels');
    }
    seen.add(city.cityId);
    return { ...city };
  });

  const order = new Map(cityIds.map((cityId, index) => [cityId, index]));
  cities.sort((a, b) => (order.get(a.cityId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.cityId) ?? Number.MAX_SAFE_INTEGER));

  return {
    homeCityId: profile.homeCityId,
    globalReputation: profile.globalReputation,
    history,
    cities,
  };
}
