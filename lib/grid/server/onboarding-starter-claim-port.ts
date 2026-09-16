import type {
  GridTerritoryClaimCommand,
  GridTerritoryClaimResult,
} from './territory-claim-port';

export interface GridOnboardingStarterClaimPort {
  claimStarterTerritory(
    command: GridTerritoryClaimCommand,
  ): Promise<GridTerritoryClaimResult>;
}
