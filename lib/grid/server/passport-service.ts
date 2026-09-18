import type {
  GridPassportCityEntryCommand,
  GridPassportCityEntryResult,
  GridPassportPersistencePort,
} from './passport-port';

export async function recordGridPassportCityEntry(
  port: GridPassportPersistencePort,
  command: GridPassportCityEntryCommand,
): Promise<GridPassportCityEntryResult> {
  if (!command.playerId.trim()) throw new Error('Grid Passport entry requires playerId');
  if (!command.cityId.trim()) throw new Error('Grid Passport entry requires cityId');
  if (!command.idempotencyKey.trim()) {
    throw new Error('Grid Passport entry requires a non-empty idempotency key');
  }
  if (!Number.isFinite(Date.parse(command.enteredAt))) {
    throw new Error('Grid Passport entry requires a valid enteredAt timestamp');
  }

  return port.recordCityEntry(command);
}
