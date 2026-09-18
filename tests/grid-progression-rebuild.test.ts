import { describe, expect, it, vi } from 'vitest';
import type { GridProgressionEvent } from '../lib/grid/core/progression-events';
import type {
  GridProgressionEventReadPort,
  GridProgressionProjectionWritePort,
} from '../lib/grid/server/progression-rebuild-port';
import { rebuildGridPlayerProgression } from '../lib/grid/server/progression-rebuild-service';

const seasonId = '00000000-0000-4000-8000-000000000010';
const playerId = '00000000-0000-4000-8000-000000000001';

function event(id: string, type = 'grid:territory_claimed', at = '2026-09-16T08:00:00.000Z'): GridProgressionEvent {
  return {
    id,
    seasonId,
    actorPlayerId: playerId,
    eventType: type,
    payload: {},
    createdAt: at,
  };
}

describe('rebuildGridPlayerProgression', () => {
  it('rebuilds season and lifetime projections from immutable events and writes source guards', async () => {
    const read: GridProgressionEventReadPort = {
      getSeasonPlayerEvents: vi.fn().mockResolvedValue([event('s1')]),
      getLifetimePlayerEvents: vi.fn().mockResolvedValue([
        event('s1'),
        { ...event('s2'), seasonId: 'other-season', createdAt: '2026-09-16T09:00:00.000Z' },
      ]),
    };
    const write: GridProgressionProjectionWritePort = {
      replaceSeasonProjection: vi.fn().mockResolvedValue({ applied: true }),
      replaceLifetimeProjection: vi.fn().mockResolvedValue({ applied: true }),
    };

    const result = await rebuildGridPlayerProgression({ read, write }, { seasonId, playerId });

    expect(result.season.snapshot.stats.territoriesCaptured).toBe(1);
    expect(result.season.sourceEventCount).toBe(1);
    expect(result.season.sourceLastEventAt).toBe('2026-09-16T08:00:00.000Z');
    expect(result.season.sourceEventFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.season.policyFingerprint).toMatch(/^[a-f0-9]{64}$/);

    expect(result.lifetime.snapshot.stats.territoriesCaptured).toBe(2);
    expect(result.lifetime.sourceEventCount).toBe(2);
    expect(result.lifetime.sourceLastEventAt).toBe('2026-09-16T09:00:00.000Z');

    expect(write.replaceSeasonProjection).toHaveBeenCalledWith(
      expect.objectContaining({ seasonId, playerId, sourceEventCount: 1 }),
    );
    expect(write.replaceLifetimeProjection).toHaveBeenCalledWith(
      expect.objectContaining({ playerId, sourceEventCount: 2 }),
    );
  });

  it('produces the same fingerprints and snapshots when the read adapter returns a different order', async () => {
    const a = event('a', 'grid:territory_claimed', '2026-09-16T08:00:00.000Z');
    const b = event('b', 'grid:territory_claimed', '2026-09-16T08:00:01.000Z');
    const write: GridProgressionProjectionWritePort = {
      replaceSeasonProjection: vi.fn().mockResolvedValue({ applied: true }),
      replaceLifetimeProjection: vi.fn().mockResolvedValue({ applied: true }),
    };

    const first = await rebuildGridPlayerProgression(
      {
        read: {
          getSeasonPlayerEvents: vi.fn().mockResolvedValue([a, b]),
          getLifetimePlayerEvents: vi.fn().mockResolvedValue([a, b]),
        },
        write,
      },
      { seasonId, playerId },
    );
    const second = await rebuildGridPlayerProgression(
      {
        read: {
          getSeasonPlayerEvents: vi.fn().mockResolvedValue([b, a]),
          getLifetimePlayerEvents: vi.fn().mockResolvedValue([b, a]),
        },
        write,
      },
      { seasonId, playerId },
    );

    expect(second.season).toEqual(first.season);
    expect(second.lifetime).toEqual(first.lifetime);
  });
});
