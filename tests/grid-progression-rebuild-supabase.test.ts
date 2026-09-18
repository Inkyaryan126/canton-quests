import { describe, expect, it, vi } from 'vitest';
import { createSupabaseGridProgressionRebuildPorts } from '../lib/grid/server/supabase-progression-rebuild';

const seasonId = '00000000-0000-4000-8000-000000000010';
const playerId = '00000000-0000-4000-8000-000000000001';

function row(id: string, createdAt: string) {
  return {
    id,
    season_id: seasonId,
    actor_player_id: playerId,
    event_type: 'grid:territory_claimed',
    payload: { territorySlug: id },
    created_at: createdAt,
  };
}

function projection() {
  return {
    seasonId,
    playerId,
    sourceEventCount: 2,
    sourceEventFingerprint: 'a'.repeat(64),
    policyFingerprint: 'b'.repeat(64),
    sourceLastEventAt: '2026-09-16T08:00:01.000Z',
    snapshot: {
      version: 1 as const,
      totalXp: 0,
      level: 1,
      gridRating: 100,
      stats: {} as any,
      categoryScores: {} as any,
      titles: ['District King'],
      primaryTitle: 'District King',
    },
  };
}

describe('Supabase Grid progression rebuild ports', () => {
  it('requires service-role Supabase configuration', () => {
    expect(() => createSupabaseGridProgressionRebuildPorts(null as any)).toThrow(
      'Grid progression rebuild requires Supabase service-role configuration',
    );
  });

  it('paginates immutable actor events in stable created_at/id order', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) =>
      row(`event-${String(index).padStart(3, '0')}`, `2026-09-16T08:00:${String(index % 60).padStart(2, '0')}.000Z`),
    );
    const secondPage = [row('event-500', '2026-09-16T09:00:00.000Z')];

    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.range = vi
      .fn()
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null });
    const from = vi.fn(() => builder);

    const ports = createSupabaseGridProgressionRebuildPorts({ from, rpc: vi.fn() } as any);
    const events = await ports.read.getSeasonPlayerEvents(seasonId, playerId);

    expect(events).toHaveLength(501);
    expect(from).toHaveBeenCalledWith('grid_game_events');
    expect(builder.eq).toHaveBeenCalledWith('actor_player_id', playerId);
    expect(builder.eq).toHaveBeenCalledWith('season_id', seasonId);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(builder.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(builder.range).toHaveBeenNthCalledWith(2, 500, 999);
    expect(events[500]).toMatchObject({ id: 'event-500', actorPlayerId: playerId });
  });

  it('reads lifetime events without adding a season filter', async () => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.range = vi.fn().mockResolvedValue({ data: [row('event-1', '2026-09-16T08:00:00.000Z')], error: null });
    const from = vi.fn(() => builder);

    const ports = createSupabaseGridProgressionRebuildPorts({ from, rpc: vi.fn() } as any);
    await ports.read.getLifetimePlayerEvents(playerId);

    expect(builder.eq).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('actor_player_id', playerId);
  });

  it('maps projection writes to guarded atomic RPCs', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { applied: true }, error: null })
      .mockResolvedValueOnce({ data: { applied: false }, error: null });
    const ports = createSupabaseGridProgressionRebuildPorts({ from: vi.fn(), rpc } as any);
    const season = projection();
    const lifetime = { ...season };
    delete (lifetime as any).seasonId;

    await expect(ports.write.replaceSeasonProjection(season)).resolves.toEqual({ applied: true });
    await expect(ports.write.replaceLifetimeProjection(lifetime)).resolves.toEqual({ applied: false });

    expect(rpc).toHaveBeenNthCalledWith(1, 'grid_replace_season_progression_projection', {
      p_season_id: seasonId,
      p_player_id: playerId,
      p_source_event_count: 2,
      p_source_event_fingerprint: 'a'.repeat(64),
      p_policy_fingerprint: 'b'.repeat(64),
      p_source_last_event_at: '2026-09-16T08:00:01.000Z',
      p_snapshot: season.snapshot,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'grid_replace_lifetime_progression_projection', {
      p_player_id: playerId,
      p_source_event_count: 2,
      p_source_event_fingerprint: 'a'.repeat(64),
      p_policy_fingerprint: 'b'.repeat(64),
      p_source_last_event_at: '2026-09-16T08:00:01.000Z',
      p_snapshot: season.snapshot,
    });
  });

  it('surfaces event read and projection write errors', async () => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.range = vi.fn().mockResolvedValue({ data: null, error: { message: 'read failed' } });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'write failed' } });
    const ports = createSupabaseGridProgressionRebuildPorts({ from: vi.fn(() => builder), rpc } as any);

    await expect(ports.read.getLifetimePlayerEvents(playerId)).rejects.toThrow(
      'Failed to read Grid progression events: read failed',
    );
    await expect(ports.write.replaceSeasonProjection(projection())).rejects.toThrow(
      'Failed to replace Grid season progression projection: write failed',
    );
  });
});
