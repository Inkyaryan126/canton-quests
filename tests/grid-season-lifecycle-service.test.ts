import { describe, expect, it, vi } from 'vitest';
import type { GridSeasonLifecyclePort } from '../lib/grid/server/season-lifecycle-port';
import { reconcileGridSeasonLifecycle } from '../lib/grid/server/season-lifecycle-service';

const now = '2026-09-28T12:00:00.000Z';

function port(status: 'scheduled' | 'active' | 'surge' = 'active'): GridSeasonLifecyclePort {
  return {
    readSeason: vi.fn().mockResolvedValue({
      cityId: 'city-1',
      seasonId: 'season-1',
      status,
      startsAt: '2026-09-01T00:00:00.000Z',
      surgeStartsAt: '2026-09-28T00:00:00.000Z',
      endsAt: '2026-10-01T00:00:00.000Z',
    }),
    reconcile: vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      previousStatus: status,
      status: 'surge',
      changed: true,
      duplicate: false,
      eventId: 'event-1',
      updatedAt: now,
    }),
  };
}

describe('Grid season lifecycle service', () => {
  it('derives scope server-side then forwards only season id, Surge duration, and server time', async () => {
    const source = port('active');
    const result = await reconcileGridSeasonLifecycle(source, {
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      surgeHours: 72,
      now,
    });

    expect(source.readSeason).toHaveBeenCalledWith('canton-oh', 'founding-season');
    expect(source.reconcile).toHaveBeenCalledWith({
      seasonId: 'season-1',
      surgeHours: 72,
      now,
    });
    expect(result).toMatchObject({ changed: true, status: 'surge' });
  });

  it('does not write when persisted state already matches the clock', async () => {
    const source = port('surge');
    const result = await reconcileGridSeasonLifecycle(source, {
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      surgeHours: 72,
      now,
    });

    expect(source.reconcile).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      seasonId: 'season-1',
      previousStatus: 'surge',
      status: 'surge',
      changed: false,
      eventId: null,
    });
  });

  it('fails closed when the configured season cannot be resolved', async () => {
    const source = port();
    vi.mocked(source.readSeason).mockResolvedValue(null);

    await expect(
      reconcileGridSeasonLifecycle(source, {
        citySlug: 'canton-oh',
        seasonSlug: 'founding-season',
        surgeHours: 72,
        now,
      }),
    ).rejects.toThrow('could not resolve');
    expect(source.reconcile).not.toHaveBeenCalled();
  });
});
