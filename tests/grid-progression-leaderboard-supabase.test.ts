import { describe, expect, it, vi } from 'vitest';
import { createSupabaseGridProgressionLeaderboardDataPort } from '../lib/grid/server/supabase-progression-leaderboard';

function progressionRow(playerId: string) {
  return { player_id: playerId, total_xp: 500, stats: { territoriesCaptured: 2 } };
}

describe('Supabase Grid progression leaderboard data port', () => {
  it('requires service-role configuration', () => {
    expect(() => createSupabaseGridProgressionLeaderboardDataPort(null as any)).toThrow(
      'Grid progression leaderboard requires Supabase service-role configuration',
    );
  });

  it('paginates all season progression candidates instead of only overall top rows', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => progressionRow(`p${index}`));
    const secondPage = [progressionRow('p500')];
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.range = vi
      .fn()
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null });
    const from = vi.fn(() => builder);

    const port = createSupabaseGridProgressionLeaderboardDataPort({ from } as any);
    const result = await port.getSeasonCandidates('season-1');

    expect(result).toHaveLength(501);
    expect(builder.eq).toHaveBeenCalledWith('season_id', 'season-1');
    expect(builder.order).toHaveBeenCalledWith('player_id', { ascending: true });
    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(builder.range).toHaveBeenNthCalledWith(2, 500, 999);
    expect(result[0].snapshot.stats.territoriesCaptured).toBe(2);
  });

  it('deduplicates and chunks public profile reads', async () => {
    const profileBuilder: any = {};
    profileBuilder.select = vi.fn(() => profileBuilder);
    profileBuilder.in = vi
      .fn()
      .mockResolvedValueOnce({
        data: Array.from({ length: 200 }, (_, index) => ({
          id: `p${index}`,
          display_name: `Callsign ${index}`,
          avatar_url: null,
        })),
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'p200', display_name: 'Callsign 200', avatar_url: '/avatar.png' }],
        error: null,
      });
    const from = vi.fn(() => profileBuilder);
    const ids = [...Array.from({ length: 201 }, (_, index) => `p${index}`), 'p0'];

    const port = createSupabaseGridProgressionLeaderboardDataPort({ from } as any);
    const profiles = await port.getPublicProfiles(ids);

    expect(profileBuilder.in).toHaveBeenCalledTimes(2);
    expect((profileBuilder.in.mock.calls[0][1] as string[])).toHaveLength(200);
    expect((profileBuilder.in.mock.calls[1][1] as string[])).toHaveLength(1);
    expect(profiles).toHaveLength(201);
    expect(profiles.at(-1)).toEqual({
      playerId: 'p200',
      callsign: 'Callsign 200',
      avatarUrl: '/avatar.png',
    });
  });

  it('surfaces candidate and public-profile read errors', async () => {
    const progressionBuilder: any = {};
    progressionBuilder.select = vi.fn(() => progressionBuilder);
    progressionBuilder.eq = vi.fn(() => progressionBuilder);
    progressionBuilder.order = vi.fn(() => progressionBuilder);
    progressionBuilder.range = vi.fn().mockResolvedValue({ data: null, error: { message: 'candidate fail' } });
    const progressionPort = createSupabaseGridProgressionLeaderboardDataPort({
      from: vi.fn(() => progressionBuilder),
    } as any);
    await expect(progressionPort.getSeasonCandidates('season')).rejects.toThrow(
      'Failed to read Grid progression leaderboard candidates: candidate fail',
    );

    const profileBuilder: any = {};
    profileBuilder.select = vi.fn(() => profileBuilder);
    profileBuilder.in = vi.fn().mockResolvedValue({ data: null, error: { message: 'profile fail' } });
    const profilePort = createSupabaseGridProgressionLeaderboardDataPort({
      from: vi.fn(() => profileBuilder),
    } as any);
    await expect(profilePort.getPublicProfiles(['p1'])).rejects.toThrow(
      'Failed to read Grid public player profiles: profile fail',
    );
  });
});
