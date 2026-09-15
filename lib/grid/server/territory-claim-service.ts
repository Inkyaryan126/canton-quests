import type {
  GridTerritoryClaimCommand,
  GridTerritoryClaimPort,
  GridTerritoryClaimResult,
} from './territory-claim-port';

function validateClaim(command: GridTerritoryClaimCommand): void {
  if (!command.idempotencyKey.trim()) {
    throw new Error('Grid territory claim requires a non-empty idempotency key');
  }
  if (!Number.isFinite(Date.parse(command.now))) {
    throw new Error('Grid territory claim requires a valid now timestamp');
  }
  if (!command.seasonId.trim() || !command.playerId.trim() || !command.territoryId.trim()) {
    throw new Error('Grid territory claim requires seasonId, playerId, and territoryId');
  }
}

export async function claimNeutralGridTerritory(
  port: GridTerritoryClaimPort,
  command: GridTerritoryClaimCommand,
): Promise<GridTerritoryClaimResult> {
  validateClaim(command);
  return port.claimNeutralTerritory(command);
}
