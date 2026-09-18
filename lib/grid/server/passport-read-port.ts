export interface GridPassportStoredProfile {
  homeCityId: string | null;
  globalReputation: number;
  passport: unknown;
}

export interface GridPassportReadPort {
  getProfile(playerId: string): Promise<GridPassportStoredProfile | null>;
}
