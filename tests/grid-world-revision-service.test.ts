import { describe, expect, it, vi } from 'vitest';
import type { GridWorldRevisionPort } from '../lib/grid/server/world-revision-port';
import { readGridWorldRevision } from '../lib/grid/server/world-revision-service';
import { createSupabaseGridWorldRevisionPort } from '../lib/grid/server/supabase-world-revision';

function port(state: Awaited<ReturnType<GridWorldRevisionPort['readRevisionState']>>): GridWorldRevisionPort {
  return { readRevisionState: vi.fn().mockResolvedValue(state) };
}

const baseState = {
  seasonId: '00000000-0000-4000-8000-000000000001',
  seasonStatus: 'active',
  seasonUpdatedAt: '2026-09-17T20:00:00.000Z',
  latestEventId: '00000000-0000-4000-8000-000000000002',
  latestEventAt: '2026-09-17T20:01:00.000Z',
};

describe('Grid world revision service', () => {
  it('returns a stable opaque active-season revision without exposing ids', async () => {
    const first = await readGridWorldRevision(port(baseState), 'canton-oh', 'founding-season');
    const second = await readGridWorldRevision(port(baseState), 'canton-oh', 'founding-season');

    expect(first).toEqual(second);
    expect(first.available).toBe(true);
    expect(first.recommendedPollMs).toBe(5_000);
    expect(first.changedAt).toBe(baseState.latestEventAt);
    expect(first.revision).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(first.revision).not.toContain(baseState.seasonId);
    expect(first.revision).not.toContain(baseState.latestEventId);
  });

  it('changes revision when the authoritative event cursor changes', async () => {
    const first = await readGridWorldRevision(port(baseState), 'canton-oh', 'founding-season');
    const second = await readGridWorldRevision(
      port({ ...baseState, latestEventId: '00000000-0000-4000-8000-000000000099' }),
      'canton-oh',
      'founding-season',
    );

    expect(second.revision).not.toBe(first.revision);
  });

  it('backs off when the season is idle and handles an unavailable runtime', async () => {
    const archived = await readGridWorldRevision(
      port({ ...baseState, seasonStatus: 'archived' }),
      'canton-oh',
      'founding-season',
    );
    const unavailable = await readGridWorldRevision(port(null), 'canton-oh', 'founding-season');

    expect(archived.recommendedPollMs).toBe(30_000);
    expect(unavailable).toEqual({
      available: false,
      revision: null,
      changedAt: null,
      seasonStatus: null,
      recommendedPollMs: 30_000,
    });
  });

  it('rejects malformed requests and timestamps before emitting a token', async () => {
    const p = port(baseState);
    await expect(readGridWorldRevision(p, ' ', 'founding-season')).rejects.toThrow(
      'Grid world revision requires citySlug',
    );
    expect(p.readRevisionState).not.toHaveBeenCalled();

    await expect(
      readGridWorldRevision(
        port({ ...baseState, latestEventAt: 'not-a-date' }),
        'canton-oh',
        'founding-season',
      ),
    ).rejects.toThrow('Grid world revision encountered invalid latestEventAt');
  });
});

describe('Supabase Grid world revision adapter', () => {
  it('requires service-role configuration', () => {
    expect(() => createSupabaseGridWorldRevisionPort(null as any)).toThrow(
      'Grid world revision requires Supabase service-role configuration',
    );
  });
});
