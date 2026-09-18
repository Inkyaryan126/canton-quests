import { appendGridEvent } from './event-ledger';
import type { GridEventLedgerPort } from './event-ledger-port';
import type { GridPassportProjection } from '../core/passport-types';
import type { GridPassportPersistencePort } from './passport-port';
import { rebuildGridPassport } from './passport-service';

export interface GridPassportHomeCityCommand {
  playerId: string;
  cityId: string;
  citySlug: string;
  occurredAt: string;
}

export interface GridPassportHomeCityResult {
  eventId: string;
  passport: GridPassportProjection;
}

function requireValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Grid Passport Home City requires ${field}`);
  return normalized;
}

export async function recordGridPassportHomeCity(
  eventLedger: GridEventLedgerPort,
  passportPort: GridPassportPersistencePort,
  command: GridPassportHomeCityCommand,
): Promise<GridPassportHomeCityResult> {
  const playerId = requireValue(command.playerId, 'playerId');
  const cityId = requireValue(command.cityId, 'cityId');
  const citySlug = requireValue(command.citySlug, 'citySlug');
  if (!Number.isFinite(Date.parse(command.occurredAt))) {
    throw new Error('Grid Passport Home City requires a valid occurredAt timestamp');
  }

  const event = await appendGridEvent(eventLedger, {
    cityId,
    seasonId: null,
    actorPlayerId: playerId,
    eventType: 'grid:passport_home_city_set',
    entityType: 'city',
    entityId: cityId,
    payload: { citySlug },
    idempotencyKey: `passport:home-city-set:${playerId}:${cityId}`,
  });

  const passport = await rebuildGridPassport(
    passportPort,
    playerId,
    command.occurredAt,
  );

  return { eventId: event.id, passport };
}
