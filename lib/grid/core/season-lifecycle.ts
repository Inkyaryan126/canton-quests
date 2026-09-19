export type GridSeasonLifecycleStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'surge'
  | 'complete'
  | 'archived';

export interface GridSeasonLifecycleState {
  status: GridSeasonLifecycleStatus;
  startsAt: string | null;
  surgeStartsAt: string | null;
  endsAt: string | null;
}

const STATUS_ORDER: Record<GridSeasonLifecycleStatus, number> = {
  draft: 0,
  scheduled: 1,
  active: 2,
  surge: 3,
  complete: 4,
  archived: 5,
};

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Grid season lifecycle requires valid ${label}`);
  }
  return parsed;
}

function positiveHours(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      'Grid season lifecycle requires surgeHours to be a positive safe integer',
    );
  }
  return value;
}

export function deriveGridSeasonLifecycleStatus(
  state: GridSeasonLifecycleState,
  surgeHours: number,
  now: string,
): GridSeasonLifecycleStatus {
  const nowMs = timestamp(now, 'now');

  if (state.status === 'draft' || state.status === 'archived') {
    return state.status;
  }
  if (state.status === 'complete') return 'complete';

  positiveHours(surgeHours);
  if (!state.startsAt || !state.endsAt) {
    throw new Error(
      'Grid season lifecycle requires startsAt and endsAt for scheduled/playable seasons',
    );
  }

  const startsAtMs = timestamp(state.startsAt, 'startsAt');
  const endsAtMs = timestamp(state.endsAt, 'endsAt');
  if (startsAtMs >= endsAtMs) {
    throw new Error('Grid season lifecycle startsAt must be before endsAt');
  }

  let surgeStartsAtMs: number;
  if (state.surgeStartsAt) {
    surgeStartsAtMs = timestamp(state.surgeStartsAt, 'surgeStartsAt');
    if (surgeStartsAtMs < startsAtMs || surgeStartsAtMs >= endsAtMs) {
      throw new Error(
        'Grid season lifecycle surgeStartsAt must fall within the season window',
      );
    }
  } else {
    const surgeDurationMs = surgeHours * 60 * 60 * 1000;
    if (!Number.isSafeInteger(surgeDurationMs)) {
      throw new Error('Grid season lifecycle Surge duration is too large');
    }
    surgeStartsAtMs = Math.max(startsAtMs, endsAtMs - surgeDurationMs);
  }

  let desired: GridSeasonLifecycleStatus;
  if (nowMs >= endsAtMs) desired = 'complete';
  else if (nowMs >= surgeStartsAtMs) desired = 'surge';
  else if (nowMs >= startsAtMs) desired = 'active';
  else desired = 'scheduled';

  return STATUS_ORDER[desired] > STATUS_ORDER[state.status]
    ? desired
    : state.status;
}
