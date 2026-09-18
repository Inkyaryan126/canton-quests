import { describe, expect, it, vi } from 'vitest';
import { rebuildGridPassport } from '../lib/grid/server/passport-service';
import type { GridPassportPersistencePort } from '../lib/grid/server/passport-port';

function fakePort(): GridPassportPersistencePort {
  return {
    listCareerEvents: vi.fn(async () => [
      {
        id: 'city-1',
        type: 'city-entered' as const,
        citySlug: 'canton-oh',
        occurredAt: '2026-09-18T04:00:00.000Z',
      },
      {
        id: 'rep-1',
        type: 'reputation-earned' as const,
        citySlug: 'canton-oh',
        amount: 75,
        reason: 'Founding achievement',
        occurredAt: '2026-09-18T04:05:00.000Z',
      },
    ]),
    saveProjection: vi.fn(async () => undefined),
  };
}

describe('Grid Passport rebuild service', () => {
  it('replays authoritative career events and caches the resulting projection', async () => {
    const port = fakePort();
    const projection = await rebuildGridPassport(
      port,
      'player-1',
      '2026-09-18T04:10:00.000Z',
    );

    expect(projection.citiesEntered).toEqual(['canton-oh']);
    expect(projection.nationalReputation).toBe(75);
    expect(port.listCareerEvents).toHaveBeenCalledWith('player-1');
    expect(port.saveProjection).toHaveBeenCalledWith(
      'player-1',
      projection,
      '2026-09-18T04:10:00.000Z',
    );
  });

  it('does not write a partial cache when authoritative replay fails', async () => {
    const port = fakePort();
    vi.mocked(port.listCareerEvents).mockResolvedValue([
      {
        id: 'bad-rep',
        type: 'reputation-earned',
        amount: 0,
        reason: 'invalid',
        occurredAt: '2026-09-18T04:05:00.000Z',
      },
    ]);

    await expect(
      rebuildGridPassport(port, 'player-1', '2026-09-18T04:10:00.000Z'),
    ).rejects.toThrow(/reputation amount/);
    expect(port.saveProjection).not.toHaveBeenCalled();
  });

  it('rejects invalid identity and rebuild timestamps before touching persistence', async () => {
    const port = fakePort();

    await expect(
      rebuildGridPassport(port, '   ', '2026-09-18T04:10:00.000Z'),
    ).rejects.toThrow(/playerId/);
    await expect(
      rebuildGridPassport(port, 'player-1', 'not-a-date'),
    ).rejects.toThrow(/rebuiltAt/);

    expect(port.listCareerEvents).not.toHaveBeenCalled();
    expect(port.saveProjection).not.toHaveBeenCalled();
  });
});
