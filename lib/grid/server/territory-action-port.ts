export interface GridTerritoryActionTarget {
  seasonId: string;
  seasonStatus: string;
  territoryId: string;
}

export interface GridTerritoryActionPort {
  resolveTarget(territorySlug: string): Promise<GridTerritoryActionTarget | null>;
}
