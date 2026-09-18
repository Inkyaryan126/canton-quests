import { describe, expect, it, vi } from 'vitest';
import { buildGridProgressionSnapshot } from '../lib/grid/core/progression';
import type { GridProgressionLeaderboardDataPort } from '../lib/grid/server/progression-leaderboard-port';
import {
  buildPublicGridProgressionLeaderboard,
  parsePublicGridProgressionBoard,
} from '../lib/grid/server/public-progression-leaderboard';

const seasonId = 'season-1';

function candidate(playerId: string, stats: Parameters<typeof buildGridProgressionSnapshot>[0]) {
  return { playerId, snapshot: buildGridProgressionSnapshot(stats) };
}

describe('public Grid progression leaderboard', () => {
  it('returns callsign-safe public entries without raw player ids', async () => {
    const port: GridProgressionLeaderboardDataPort = {
      getSeasonCandidates: vi.fn().mockResolvedValue([
        candidate('p1', { xp: 1000, territoriesCaptured: 20 }),
        candidate('p2', { xp: 2000, territoriesCaptured: 10 }),
      ]),
      getPublicProfiles: vi.fn().mockResolvedValue([
        { playerId: 'p1', callsign: 'Alpha', avatarUrl: '/a.png' },
        { playerId: 'p2', callsign: 'Bravo', avatarUrl: null },
      ]),
    };

    const result = await buildPublicGridProgressionLeaderboard(port, {
      seasonId,
      board: { type: 'stat', stat: 'territoriesCaptured' },
      limit: 20,
    });

    expect(result.entries.map((entry) => [entry.rank, entry.callsign, entry.score])).toEqual([
      [1, 'Alpha', 20],
      [2, 'Bravo', 10],
    ]);
    expect(JSON.stringify(result)).not.toContain('"playerId"');
    expect(result.entries[0]).toMatchObject({
      avatarUrl: '/a.png',
      level: 5,
      totalXp: 1000,
    });
  });

  it('excludes candidates without a usable public callsign before ranking', async () => {
    const port: GridProgressionLeaderboardDataPort = {
      getSeasonCandidates: vi.fn().mockResolvedValue([
        candidate('hidden', { territoriesCaptured: 100 }),
        candidate('visible', { territoriesCaptured: 5 }),
      ]),
      getPublicProfiles: vi.fn().mockResolvedValue([
        { playerId: 'hidden', callsign: '   ', avatarUrl: null },
        { playerId: 'visible', callsign: 'Visible', avatarUrl: null },
      ]),
    };

    const result = await buildPublicGridProgressionLeaderboard(port, {
      seasonId,
      board: { type: 'stat', stat: 'territoriesCaptured' },
      limit: 20,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[0].callsign).toBe('Visible');
  });

  it('caps result size after ranking', async () => {
    const candidates = Array.from({ length: 20 }, (_, index) =>
      candidate(`p${index}`, { xp: index * 250, territoriesCaptured: index }),
    );
    const port: GridProgressionLeaderboardDataPort = {
      getSeasonCandidates: vi.fn().mockResolvedValue(candidates),
      getPublicProfiles: vi.fn().mockResolvedValue(
        candidates.map(({ playerId }) => ({ playerId, callsign: playerId, avatarUrl: null })),
      ),
    };

    const result = await buildPublicGridProgressionLeaderboard(port, {
      seasonId,
      board: { type: 'overall' },
      limit: 3,
    });
    expect(result.entries).toHaveLength(3);
  });
});

describe('parsePublicGridProgressionBoard', () => {
  it('supports overall and category boards', () => {
    expect(parsePublicGridProgressionBoard(null, null)).toEqual({ type: 'overall' });
    expect(parsePublicGridProgressionBoard('territory', null)).toEqual({
      type: 'category',
      category: 'territory',
    });
  });

  it('supports ranking-enabled stat boards', () => {
    expect(parsePublicGridProgressionBoard('stat', 'territoriesCaptured')).toEqual({
      type: 'stat',
      stat: 'territoriesCaptured',
    });
  });

  it('rejects unknown boards and non-ranking stats', () => {
    expect(() => parsePublicGridProgressionBoard('wat', null)).toThrow('Unknown Grid leaderboard board');
    expect(() => parsePublicGridProgressionBoard('stat', 'heat')).toThrow(
      'Grid stat heat is not ranking-enabled',
    );
  });
});
