export interface GridStarterTerritoryRuntimeState {
  territoryId: string;
  territorySlug: string;
  occupied: boolean;
}

export interface GridStarterTerritoryContext {
  seasonPlayable: boolean;
  joined: boolean;
  credits: number;
  commandPoints: number;
  ownsAnyTerritory: boolean;
  territories: GridStarterTerritoryRuntimeState[];
}

export interface GridStarterTerritoryPort {
  getContext(playerId: string): Promise<GridStarterTerritoryContext>;
}
