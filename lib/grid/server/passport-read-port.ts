export interface GridPassportCacheRow {
  passport: unknown;
  globalReputation: number;
}

export interface GridPassportCityLabel {
  slug: string;
  name: string;
  regionCode: string;
  countryCode: string;
}

export interface GridPassportReadPort {
  readCache(playerId: string): Promise<GridPassportCacheRow | null>;
  readCities(citySlugs: readonly string[]): Promise<GridPassportCityLabel[]>;
}
