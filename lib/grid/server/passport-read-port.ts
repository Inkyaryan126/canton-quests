export interface GridPassportStoredProfile {
  homeCityId: string | null;
  globalReputation: number;
  passport: unknown;
}

export interface GridPassportCityLabel {
  cityId: string;
  slug: string;
  name: string;
  regionCode: string;
  countryCode: string;
}

export interface GridPassportReadPort {
  getProfile(playerId: string): Promise<GridPassportStoredProfile | null>;
  getCities(cityIds: readonly string[]): Promise<GridPassportCityLabel[]>;
}
