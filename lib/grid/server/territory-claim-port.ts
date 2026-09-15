export interface GridTerritoryClaimCommand {
  seasonId: string;
  playerId: string;
  territoryId: string;
  idempotencyKey: string;
  now: string;
}

export type GridTerritoryClaimMode = 'starter' | 'adjacent';

export interface GridTerritoryClaimResult {
  seasonId: string;
  cityId: string;
  playerId: string;
  territoryId: string;
  territorySlug: string;
  claimedAt: string;
  claimMode: GridTerritoryClaimMode;
  creditsSpent: number;
  commandPointsSpent: number;
  credits: number;
  influence: number;
  commandPoints: number;
  eventId: string;
}

export interface GridTerritoryClaimPort {
  claimNeutralTerritory(
    command: GridTerritoryClaimCommand,
  ): Promise<GridTerritoryClaimResult>;
}
