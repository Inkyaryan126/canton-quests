export interface GridPassportCacheRow {
  passport: unknown;
  globalReputation: number;
}

export interface GridPassportReadPort {
  readCache(playerId: string): Promise<GridPassportCacheRow | null>;
}
