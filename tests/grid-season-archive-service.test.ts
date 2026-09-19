import { describe, expect, it, vi } from 'vitest';
import { buildGridProgressionSnapshot } from '../lib/grid/core/progression';
import { cantonFoundingSeasonCityPower } from '../lib/grid/cities/canton/founding-season-city-power';
import type { GridPassportPersistencePort } from '../lib/grid/server/passport-port';
import type { GridSeasonArchivePort } from '../lib/grid/server/season-archive-port';
import {
  archiveGridSeason,
  buildGridSeasonFinalStandings,
} from '../lib/grid/server/season-archive-service';

const endedAt = '2026-09-18T04:00:00.000Z';
const now = '2026-09-18T05:00:00.000Z';

function candidate(playerId: string, overrides: Record<string, number> = {}) {
  return {
    playerId,
    snapshot: buildGridProgressionSnapshot({
      xp: 1000,
      territoryControl: 1000,
      propertyValue: 20000,
      influence: 1000,
      challengeRating: 500,
      seasonScore: 1000,
      cityMastery: 20,
      ...overrides,
    }),
  };
}

function archivePort(): GridSeasonArchivePort {
  return {
    resolveScope: vi.fn().mockResolvedValue({
      cityId: 'city-1',
      citySlug: 'canton-oh',
      seasonId: 'season-1',
      seasonSlug: 'founding-season',
      seasonName: 'Founding Season',
      seasonStatus: 'surge',
      endsAt: endedAt,
    }),
    listCandidates: vi.fn().mockResolvedValue([
      candidate('player-b', {
        territoryControl: 6000,
        propertyValue: 100000,
        influence: 6000,
      }),
      candidate('player-a', {
        territoryControl: 6000,
        propertyValue: 100000,
        influence: 6000,
      }),
      candidate('player-c'),
    ]),
    archiveSeason: vi.fn().mockImplementation(async (command) => ({
      seasonId: command.seasonId,
      cityId: 'city-1',
      status: 'archived' as const,
      archivedAt: command.now,
      standingsCount: command.standings.length,
      championPlayerId: command.standings[0]?.playerId ?? null,
      eventId: 'archive-event',
    })),
  };
}

function passportPort(): GridPassportPersistencePort {
  return {
    listCareerEvents: vi.fn().mockResolvedValue([]),
    saveProjection: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Grid season archive service', () => {
  it('builds strict deterministic final placements with one champion', () => {
    const standings = buildGridSeasonFinalStandings(
      [
        candidate('player-b', { seasonScore: 5000 }),
        candidate('player-a', { seasonScore: 5000 }),
        candidate('player-c', { seasonScore: 1000 }),
      ],
      cantonFoundingSeasonCityPower,
    );

    expect(standings.map(({ playerId, finalRank }) => [playerId, finalRank])).toEqual([
      ['player-a', 1],
      ['player-b', 2],
      ['player-c', 3],
    ]);
    expect(standings[0].cityPowerBps).toBe(standings[1].cityPowerBps);
    expect(standings.every((entry) => entry.cityPowerBps <= 10000)).toBe(true);
    expect(standings.every((entry) => entry.cityPowerBreakdown.length === 6)).toBe(true);
  });

  it('archives only after the configured end and forwards all joined-player standings', async () => {
    const archive = archivePort();
    const passport = passportPort();

    const result = await archiveGridSeason(archive, passport, {
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      cityPowerConfig: cantonFoundingSeasonCityPower,
      idempotencyKey: 'archive-1',
      now,
    });

    expect(archive.resolveScope).toHaveBeenCalledWith('canton-oh', 'founding-season');
    expect(archive.listCandidates).toHaveBeenCalledWith('season-1');
    expect(archive.archiveSeason).toHaveBeenCalledWith({
      seasonId: 'season-1',
      standings: result.standings,
      idempotencyKey: 'archive-1',
      now,
    });
    expect(result.archive.status).toBe('archived');
    expect(result.standings).toHaveLength(3);
    expect(result.passportRebuiltCount).toBe(3);
    expect(result.passportRebuildFailedPlayerIds).toEqual([]);
    expect(passport.saveProjection).toHaveBeenCalledTimes(3);
  });

  it('allows idempotent archive replay after the season is already archived', async () => {
    const archive = archivePort();
    vi.mocked(archive.resolveScope).mockResolvedValue({
      cityId: 'city-1',
      citySlug: 'canton-oh',
      seasonId: 'season-1',
      seasonSlug: 'founding-season',
      seasonName: 'Founding Season',
      seasonStatus: 'archived',
      endsAt: endedAt,
    });

    await expect(
      archiveGridSeason(archive, passportPort(), {
        citySlug: 'canton-oh',
        seasonSlug: 'founding-season',
        cityPowerConfig: cantonFoundingSeasonCityPower,
        idempotencyKey: 'archive-1',
        now,
      }),
    ).resolves.toMatchObject({ archive: { status: 'archived' } });
  });

  it('fails closed before season end without reading final candidates', async () => {
    const archive = archivePort();
    await expect(
      archiveGridSeason(archive, passportPort(), {
        citySlug: 'canton-oh',
        seasonSlug: 'founding-season',
        cityPowerConfig: cantonFoundingSeasonCityPower,
        idempotencyKey: 'archive-early',
        now: '2026-09-18T03:59:59.999Z',
      }),
    ).rejects.toThrow('before the season ends');

    expect(archive.listCandidates).not.toHaveBeenCalled();
    expect(archive.archiveSeason).not.toHaveBeenCalled();
  });

  it('keeps the permanent archive successful when a Passport cache rebuild needs reconciliation', async () => {
    const passport = passportPort();
    vi.mocked(passport.saveProjection)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('cache unavailable'))
      .mockResolvedValueOnce(undefined);

    const result = await archiveGridSeason(archivePort(), passport, {
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      cityPowerConfig: cantonFoundingSeasonCityPower,
      idempotencyKey: 'archive-cache-warning',
      now,
    });

    expect(result.archive.status).toBe('archived');
    expect(result.passportRebuiltCount).toBe(2);
    expect(result.passportRebuildFailedPlayerIds).toHaveLength(1);
  });

  it('rejects duplicate candidate identities before persistence', () => {
    expect(() =>
      buildGridSeasonFinalStandings(
        [candidate('same-player'), candidate('same-player')],
        cantonFoundingSeasonCityPower,
      ),
    ).toThrow('duplicate player');
  });
});
