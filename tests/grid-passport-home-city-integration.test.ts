import { describe, expect, it, vi } from 'vitest';
import type { GridEventLedgerPort } from '../lib/grid/server/event-ledger-port';
import type { GridPassportPersistencePort } from '../lib/grid/server/passport-port';
import { recordGridPassportHomeCity } from '../lib/grid/server/passport-home-city-service';

const occurredAt = '2026-09-18T05:20:00.000Z';

function ledger(): GridEventLedgerPort {
  return {
    insert: vi.fn().mockResolvedValue({
      duplicate: false,
      event: {
        id: 'event-home', cityId: 'city-1', seasonId: null, actorPlayerId: 'player-1',
        eventType: 'grid:passport_home_city_set', entityType: 'city', entityId: 'city-1',
        payload: { citySlug: 'canton-oh' }, idempotencyKey: 'passport:home-city-set:player-1:city-1',
        correlationId: null, causationId: null, createdAt: occurredAt,
      },
    }),
    getByIdempotencyKey: vi.fn(),
  };
}

function passportPort(): GridPassportPersistencePort {
  return {
    listCareerEvents: vi.fn().mockResolvedValue([
      { id: 'event-home', type: 'home-city-set', citySlug: 'canton-oh', occurredAt },
    ]),
    saveProjection: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Grid Passport Home City integration', () => {
  it('appends one permanent Home City event then rebuilds the canonical cache', async () => {
    const eventLedger = ledger();
    const passport = passportPort();
    const result = await recordGridPassportHomeCity(eventLedger, passport, {
      playerId: 'player-1', cityId: 'city-1', citySlug: 'canton-oh', occurredAt,
    });

    expect(eventLedger.insert).toHaveBeenCalledWith({
      cityId: 'city-1', seasonId: null, actorPlayerId: 'player-1',
      eventType: 'grid:passport_home_city_set', entityType: 'city', entityId: 'city-1',
      payload: { citySlug: 'canton-oh' },
      idempotencyKey: 'passport:home-city-set:player-1:city-1',
    });
    expect(result.passport.homeCitySlug).toBe('canton-oh');
    expect(result.passport.citiesEntered).toEqual(['canton-oh']);
    expect(passport.saveProjection).toHaveBeenCalledTimes(1);
  });

  it('validates trusted command identity before touching persistence', async () => {
    const eventLedger = ledger();
    const passport = passportPort();
    await expect(recordGridPassportHomeCity(eventLedger, passport, {
      playerId: ' ', cityId: 'city-1', citySlug: 'canton-oh', occurredAt,
    })).rejects.toThrow('requires playerId');
    expect(eventLedger.insert).not.toHaveBeenCalled();
  });
});
