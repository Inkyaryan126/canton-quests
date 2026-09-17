import { describe, expect, it } from 'vitest';
import { deriveSurgeTiming } from '@/lib/grid/core/surge-timing';

describe('deriveSurgeTiming', () => {
  const timing = { surgeStartsAt: '2026-09-28T12:00:00Z', endsAt: '2026-10-01T12:00:00Z' };

  it('derives upcoming, live, and finished states from an explicit clock', () => {
    expect(deriveSurgeTiming(timing, '2026-09-28T11:00:00Z')).toEqual({ state: 'upcoming', millisecondsRemaining: 3_600_000 });
    expect(deriveSurgeTiming(timing, '2026-09-29T12:00:00Z')).toEqual({ state: 'live', millisecondsRemaining: 172_800_000 });
    expect(deriveSurgeTiming(timing, '2026-10-01T12:00:00Z')).toEqual({ state: 'finished', millisecondsRemaining: 0 });
  });

  it('returns unavailable for missing, invalid, or inconsistent timing', () => {
    expect(deriveSurgeTiming({ surgeStartsAt: null, endsAt: null }, '2026-09-28T11:00:00Z')).toEqual({ state: 'unavailable', millisecondsRemaining: null });
    expect(deriveSurgeTiming({ surgeStartsAt: 'bad', endsAt: timing.endsAt }, '2026-09-28T11:00:00Z').state).toBe('unavailable');
    expect(deriveSurgeTiming({ surgeStartsAt: timing.endsAt, endsAt: timing.surgeStartsAt }, '2026-09-28T11:00:00Z').state).toBe('unavailable');
  });
});
