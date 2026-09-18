import type { GridPassportHistory } from '../core/passport-types';

export interface GridPassportCityEntryCommand {
  playerId: string;
  cityId: string;
  idempotencyKey: string;
  enteredAt: string;
}

export interface GridPassportCityEntryResult {
  passport: GridPassportHistory;
  eventId: string;
  recorded: boolean;
}

export interface GridPassportPersistencePort {
  recordCityEntry(
    command: GridPassportCityEntryCommand,
  ): Promise<GridPassportCityEntryResult>;
}
