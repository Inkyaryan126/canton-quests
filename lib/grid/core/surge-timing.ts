export type SurgeTimingState = 'unavailable' | 'upcoming' | 'live' | 'finished';

export interface SurgeTimingInput {
  surgeStartsAt: string | null;
  endsAt: string | null;
}

export interface SurgeTimingProjection {
  state: SurgeTimingState;
  millisecondsRemaining: number | null;
}

export function deriveSurgeTiming(input: SurgeTimingInput, now: string): SurgeTimingProjection {
  if (!input.surgeStartsAt || !input.endsAt) return { state: 'unavailable', millisecondsRemaining: null };
  const start = Date.parse(input.surgeStartsAt);
  const end = Date.parse(input.endsAt);
  const current = Date.parse(now);
  if (![start, end, current].every(Number.isFinite) || start >= end) {
    return { state: 'unavailable', millisecondsRemaining: null };
  }
  if (current < start) return { state: 'upcoming', millisecondsRemaining: start - current };
  if (current < end) return { state: 'live', millisecondsRemaining: end - current };
  return { state: 'finished', millisecondsRemaining: 0 };
}
