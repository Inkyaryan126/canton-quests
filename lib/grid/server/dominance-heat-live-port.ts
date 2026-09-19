export interface GridDominanceHeatAllianceContext {
  allianceId: string;
  name: string;
  controlledTerritories: number;
}

export interface GridDominanceHeatLiveContext {
  seasonId: string;
  seasonStatus: string;
  joined: boolean;
  eligibleTerritories: number;
  playerControlledTerritories: number;
  alliance: GridDominanceHeatAllianceContext | null;
}

export interface GridDominanceHeatLivePort {
  readContext(playerId: string): Promise<GridDominanceHeatLiveContext | null>;
}
