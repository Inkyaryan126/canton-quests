import { describe, expect, it, vi } from 'vitest';
import { emptyGridPassport } from '../lib/grid/core/passport';
import { readGridPassport } from '../lib/grid/server/passport-read-service';
import type { GridPassportReadPort } from '../lib/grid/server/passport-read-port';

function portWith(value: Awaited<ReturnType<GridPassportReadPort['readCache']>>): GridPassportReadPort {
  return {
    readCache: vi.fn(async () => value),
    readCities: vi.fn(async (citySlugs) => citySlugs.map((slug: string) => ({
      slug, name: slug === 'canton-oh' ? 'Canton' : slug, regionCode: 'OH', countryCode: 'US',
    }))),
  };
}

describe('Grid Passport private read service', () => {
  it('reports a missing cache without fabricating career history', async () => {
    await expect(readGridPassport(portWith(null), 'player-1')).resolves.toEqual({
      cacheState: 'missing',
      passport: null,
      cities: [],
    });
  });

  it('returns a valid cache only when projection and reputation agree', async () => {
    const passport = {
      ...emptyGridPassport(),
      citiesEntered: ['canton-oh'],
      nationalReputation: 50,
      processedEventCount: 2,
      lastUpdatedAt: '2026-09-18T04:10:00.000Z',
    };

    await expect(
      readGridPassport(
        portWith({ passport, globalReputation: 50 }),
        'player-1',
      ),
    ).resolves.toEqual({
      cacheState: 'ready',
      passport,
      cities: [{ slug: 'canton-oh', name: 'Canton', regionCode: 'OH', countryCode: 'US' }],
    });
  });

  it('fails the cache closed when shape or authoritative reputation disagrees', async () => {
    await expect(
      readGridPassport(
        portWith({ passport: {}, globalReputation: 0 }),
        'player-1',
      ),
    ).resolves.toEqual({ cacheState: 'invalid', passport: null, cities: [] });

    const passport = { ...emptyGridPassport(), nationalReputation: 10 };
    await expect(
      readGridPassport(
        portWith({ passport, globalReputation: 11 }),
        'player-1',
      ),
    ).resolves.toEqual({ cacheState: 'invalid', passport: null, cities: [] });
  });

  it('rejects blank player identity before persistence access', async () => {
    const port = portWith(null);
    await expect(readGridPassport(port, '   ')).rejects.toThrow(/playerId/);
    expect(port.readCache).not.toHaveBeenCalled();
  });
});
