import { describe, expect, it } from 'vitest';
import { deriveGridSeasonLifecycleStatus } from '../lib/grid/core/season-lifecycle';

const base = {
  status: 'scheduled' as const,
  startsAt: '2026-09-01T00:00:00.000Z',
  surgeStartsAt: null,
  endsAt: '2026-10-01T00:00:00.000Z',
};

describe('Grid season lifecycle core', () => {
  it('derives scheduled, active, Surge, and complete from the authoritative window', () => {
    expect(
      deriveGridSeasonLifecycleStatus(
        base,
        72,
        '2026-08-31T23:59:59.000Z',
      ),
    ).toBe('scheduled');
    expect(
      deriveGridSeasonLifecycleStatus(base, 72, '2026-09-01T00:00:00.000Z'),
    ).toBe('active');
    expect(
      deriveGridSeasonLifecycleStatus(base, 72, '2026-09-28T00:00:00.000Z'),
    ).toBe('surge');
    expect(
      deriveGridSeasonLifecycleStatus(base, 72, '2026-10-01T00:00:00.000Z'),
    ).toBe('complete');
  });

  it('allows a missed reconciliation to jump directly to the correct later phase', () => {
    expect(
      deriveGridSeasonLifecycleStatus(base, 72, '2026-10-02T00:00:00.000Z'),
    ).toBe('complete');
  });

  it('never regresses an already advanced persisted status', () => {
    expect(
      deriveGridSeasonLifecycleStatus(
        { ...base, status: 'active' },
        72,
        '2026-08-20T00:00:00.000Z',
      ),
    ).toBe('active');
    expect(
      deriveGridSeasonLifecycleStatus(
        { ...base, status: 'surge' },
        72,
        '2026-09-10T00:00:00.000Z',
      ),
    ).toBe('surge');
  });

  it('never auto-starts draft seasons or changes archived seasons', () => {
    expect(
      deriveGridSeasonLifecycleStatus(
        {
          status: 'draft',
          startsAt: null,
          surgeStartsAt: null,
          endsAt: null,
        },
        72,
        '2026-10-20T00:00:00.000Z',
      ),
    ).toBe('draft');
    expect(
      deriveGridSeasonLifecycleStatus(
        {
          status: 'archived',
          startsAt: null,
          surgeStartsAt: null,
          endsAt: null,
        },
        72,
        '2026-10-20T00:00:00.000Z',
      ),
    ).toBe('archived');
  });

  it('honors an explicit persisted Surge start before the derived duration', () => {
    expect(
      deriveGridSeasonLifecycleStatus(
        {
          ...base,
          surgeStartsAt: '2026-09-25T12:00:00.000Z',
        },
        72,
        '2026-09-25T12:00:00.000Z',
      ),
    ).toBe('surge');
  });

  it('rejects incomplete or malformed playable season timing', () => {
    expect(() =>
      deriveGridSeasonLifecycleStatus(
        { ...base, startsAt: null },
        72,
        '2026-09-20T00:00:00.000Z',
      ),
    ).toThrow('startsAt and endsAt');
    expect(() =>
      deriveGridSeasonLifecycleStatus(
        {
          ...base,
          surgeStartsAt: '2026-10-02T00:00:00.000Z',
        },
        72,
        '2026-09-20T00:00:00.000Z',
      ),
    ).toThrow('surgeStartsAt');
  });

  it('requires a positive safe Surge duration for playable seasons', () => {
    expect(() =>
      deriveGridSeasonLifecycleStatus(base, 0, '2026-09-20T00:00:00.000Z'),
    ).toThrow('surgeHours');
  });
});
