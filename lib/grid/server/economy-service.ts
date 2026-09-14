import type {
  GridEconomyCommand,
  GridEconomyCommandPort,
  GridPlayerSeasonState,
} from './economy-port';

function validateCommand(command: GridEconomyCommand): void {
  if (!command.idempotencyKey.trim()) {
    throw new Error('Grid economy command requires a non-empty idempotency key');
  }
  if (!Number.isFinite(Date.parse(command.now))) {
    throw new Error('Grid economy command requires a valid now timestamp');
  }
  if (!command.seasonId.trim() || !command.playerId.trim()) {
    throw new Error('Grid economy command requires seasonId and playerId');
  }
}

export async function joinGridSeason(
  port: GridEconomyCommandPort,
  command: GridEconomyCommand,
): Promise<GridPlayerSeasonState> {
  validateCommand(command);
  return port.joinSeason(command);
}

export async function settleGridPlayerResources(
  port: GridEconomyCommandPort,
  command: GridEconomyCommand,
): Promise<GridPlayerSeasonState> {
  validateCommand(command);
  return port.settleResources(command);
}
