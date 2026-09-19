import { describe, expect, it, vi } from 'vitest';
import type { GridSeasonHistoryPort } from '../lib/grid/server/season-history-port';
import { readPublicGridSeasonHistory } from '../lib/grid/server/season-history-service';

function port(): GridSeasonHistoryPort {
  return {
    readArchive: vi.fn().mockResolvedValue({
      seasonId: 'season-private-id',
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      seasonName: 'Founding Season',
      archivedAt: '2026-10-18T23:59:59.000Z',
      championPlayerId: 'player-1',
      standingsCount: 3,
    }),
    readStandings: vi.fn().mockResolvedValue([
      {
        playerId: 'player-1',
        finalRank: 1,
        cityPowerBps: 8120,
        gridRating: 7400,
        totalXp: 9200,
      },
      {
        playerId: 'player-2',
        finalRank: 2,
        cityPowerBps: 7610,
        gridRating: 7200,
        totalXp: 8800,
      },
      {
        playerId: 'player-3',
        finalRank: 3,
        cityPowerBps: 7100,
        gridRating: 6900,
        totalXp: 8100,
      },
    ]),
    readProfiles: vi.fn().mockResolvedValue([
      { playerId: 'player-1', callsign: 'ALPHA', avatarUrl: '/a.png' },
      { playerId: 'player-3', callsign: 'CHARLIE', avatarUrl: null },
    ]),
  };
}

describe('public Grid season history', () => {
  it('returns every final placement without leaking internal IDs', async () => {
    const result = await readPublicGridSeasonHistory(
      port(),
      'canton-oh',
      'founding-season',
    );

    expect(result.archive).toMatchObject({
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      seasonName: 'Founding Season',
      standingsCount: 3,
      championCallsign: 'ALPHA',
    });
    expect(result.entries.map((entry) => entry.callsign)).toEqual([
      'ALPHA',
      'Player #2',
      'CHARLIE',
    ]);
    expect(result.entries[0].champion).toBe(true);
    expect(JSON.stringify(result)).not.toContain('player-1');
    expect(JSON.stringify(result)).not.toContain('season-private-id');
    expect(result.entries[0]).not.toHaveProperty('playerId');
  });

  it('returns an empty public record before the season is archived', async () => {
    const source = port();
    vi.mocked(source.readArchive).mockResolvedValue(null);

    await expect(
      readPublicGridSeasonHistory(source, 'canton-oh', 'founding-season'),
    ).resolves.toEqual({ archive: null, entries: [] });

    expect(source.readStandings).not.toHaveBeenCalled();
    expect(source.readProfiles).not.toHaveBeenCalled();
  });

  it('fails closed when archive count and stored standings disagree', async () => {
    const source = port();
    vi.mocked(source.readStandings).mockResolvedValue(
      (await source.readStandings('season-private-id')).slice(0, 2),
    );

    await expect(
      readPublicGridSeasonHistory(source, 'canton-oh', 'founding-season'),
    ).rejects.toThrow('standings count mismatch');
  });

  it('fails closed when final ranks are not contiguous', async () => {
    const source = port();
    vi.mocked(source.readStandings).mockResolvedValue([
      {
        playerId: 'player-1',
        finalRank: 1,
        cityPowerBps: 8000,
        gridRating: 7000,
        totalXp: 9000,
      },
      {
        playerId: 'player-2',
        finalRank: 3,
        cityPowerBps: 7000,
        gridRating: 6500,
        totalXp: 8000,
      },
      {
        playerId: 'player-3',
        finalRank: 4,
        cityPowerBps: 6000,
        gridRating: 6000,
        totalXp: 7000,
      },
    ]);

    await expect(
      readPublicGridSeasonHistory(source, 'canton-oh', 'founding-season'),
    ).rejects.toThrow('final ranks are not contiguous');
  });

  it('fails closed when the archive champion is absent from final standings', async () => {
    const source = port();
    const archive = await source.readArchive('canton-oh', 'founding-season');
    vi.mocked(source.readArchive).mockResolvedValue({
      ...archive!,
      championPlayerId: 'missing-player',
    });

    await expect(
      readPublicGridSeasonHistory(source, 'canton-oh', 'founding-season'),
    ).rejects.toThrow('champion is missing');
  });
});
