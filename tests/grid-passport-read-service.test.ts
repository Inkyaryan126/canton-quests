import { describe, expect, it, vi } from 'vitest';
import type { GridPassportReadPort } from '../lib/grid/server/passport-read-port';
import { readGridPassport } from '../lib/grid/server/passport-read-service';

const HOME = 'city-home';

function port(passport: unknown): GridPassportReadPort {
  return {
    getProfile: vi.fn().mockResolvedValue({
      homeCityId: HOME,
      globalReputation: 12,
      passport,
    }),
  };
}

describe('Grid Passport read service', () => {
  it('returns an empty versioned history before the first persisted entry', async () => {
    await expect(readGridPassport(port({}), 'player-1')).resolves.toEqual({
      homeCityId: HOME,
      globalReputation: 12,
      history: { version: 1, homeCityId: HOME, citiesEntered: 0, entriesRecorded: 0, stamps: [] },
    });
  });

  it('sanitizes and deterministically sorts valid stored stamps', async () => {
    const view = await readGridPassport(port({
      version: 1,
      homeCityId: HOME,
      citiesEntered: 2,
      entriesRecorded: 3,
      stamps: [
        { cityId: 'city-2', firstEnteredAt: '2026-10-01T00:00:00.000Z', lastEnteredAt: '2026-10-02T00:00:00.000Z', entryCount: 2, isHomeCity: false },
        { cityId: HOME, firstEnteredAt: '2026-09-18T00:00:00.000Z', lastEnteredAt: '2026-09-18T00:00:00.000Z', entryCount: 1, isHomeCity: true },
      ],
      ignoredFutureField: { secret: true },
    }), 'player-1');

    expect(view?.history.stamps.map((stamp) => stamp.cityId)).toEqual([HOME, 'city-2']);
    expect(JSON.stringify(view)).not.toContain('ignoredFutureField');
  });

  it('fails closed on inconsistent or forged stored Passport state', async () => {
    await expect(readGridPassport(port({
      version: 1, homeCityId: 'wrong-city', citiesEntered: 0, entriesRecorded: 0, stamps: [],
    }), 'player-1')).rejects.toThrow('Home City does not match');

    await expect(readGridPassport(port({
      version: 1, homeCityId: HOME, citiesEntered: 1, entriesRecorded: 99,
      stamps: [{ cityId: HOME, firstEnteredAt: '2026-09-18T00:00:00.000Z', lastEnteredAt: '2026-09-18T00:00:00.000Z', entryCount: 1, isHomeCity: true }],
    }), 'player-1')).rejects.toThrow('aggregate counts are inconsistent');
  });

  it('returns null when the player has no Grid profile', async () => {
    const p: GridPassportReadPort = { getProfile: vi.fn().mockResolvedValue(null) };
    await expect(readGridPassport(p, 'player-1')).resolves.toBeNull();
  });
});
