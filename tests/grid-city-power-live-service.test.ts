import { describe, expect, it, vi } from 'vitest';
import { buildGridProgressionSnapshot } from '../lib/grid/core/progression';
import { cantonFoundingSeasonCityPower } from '../lib/grid/cities/canton/founding-season-city-power';
import type { GridProgressionLeaderboardDataPort } from '../lib/grid/server/progression-leaderboard-port';
import { buildPublicGridCityPowerLeaderboard } from '../lib/grid/server/city-power-progression-service';

function port(): GridProgressionLeaderboardDataPort {
  return {
    getSeasonCandidates: vi.fn().mockResolvedValue([
      {
        playerId: 'p-strong',
        snapshot: buildGridProgressionSnapshot({
          xp: 5000,
          territoryControl: 6000,
          propertyValue: 160000,
          influence: 7000,
          challengeRating: 1500,
          seasonScore: 7000,
          cityMastery: 70,
        }),
      },
      {
        playerId: 'p-balanced',
        snapshot: buildGridProgressionSnapshot({
          xp: 3000,
          territoryControl: 3000,
          propertyValue: 90000,
          influence: 4000,
          challengeRating: 1000,
          seasonScore: 4000,
          cityMastery: 50,
        }),
      },
      {
        playerId: 'p-hidden',
        snapshot: buildGridProgressionSnapshot({
          xp: 9000,
          territoryControl: 10000,
          propertyValue: 250000,
          influence: 10000,
          challengeRating: 2000,
          seasonScore: 10000,
          cityMastery: 100,
        }),
      },
    ]),
    getPublicProfiles: vi.fn().mockResolvedValue([
      { playerId: 'p-strong', callsign: 'Strong', avatarUrl: '/strong.png' },
      { playerId: 'p-balanced', callsign: 'Balanced', avatarUrl: null },
      { playerId: 'p-hidden', callsign: '   ', avatarUrl: null },
    ]),
  };
}

describe('public Grid City Power leaderboard', () => {
  it('ranks public players by City Power with deterministic public-only entries', async () => {
    const source = port();
    const result = await buildPublicGridCityPowerLeaderboard(source, {
      seasonId: 'season-1',
      config: cantonFoundingSeasonCityPower,
      limit: 50,
    });

    expect(source.getSeasonCandidates).toHaveBeenCalledWith('season-1');
    expect(result.board).toEqual({ type: 'city-power' });
    expect(result.entries.map((entry) => entry.callsign)).toEqual([
      'Strong',
      'Balanced',
    ]);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[0].score).toBeGreaterThan(result.entries[1].score);
    expect(result.entries[0].score).toBeLessThanOrEqual(10000);
    expect(result.entries[0]).not.toHaveProperty('playerId');
    expect(JSON.stringify(result)).not.toContain('p-hidden');
  });

  it('clamps result limits and excludes profiles without a usable callsign', async () => {
    const result = await buildPublicGridCityPowerLeaderboard(port(), {
      seasonId: 'season-1',
      config: cantonFoundingSeasonCityPower,
      limit: 1,
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].callsign).toBe('Strong');
  });

  it('fails closed when live config references a metric not backed by progression', async () => {
    await expect(
      buildPublicGridCityPowerLeaderboard(port(), {
        seasonId: 'season-1',
        config: {
          maxSingleComponentWeightBps: 10000,
          components: [
            {
              id: 'madeUpMetric',
              weightBps: 10000,
              rawCap: 100,
              curve: [{ rawValue: 100, attainmentBps: 10000 }],
            },
          ],
        },
      }),
    ).rejects.toThrow('not backed by a Grid progression stat');
  });
});
