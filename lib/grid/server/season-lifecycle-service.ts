import { deriveGridSeasonLifecycleStatus } from '../core/season-lifecycle';
import type { GridSeasonLifecyclePort } from './season-lifecycle-port';

export interface ReconcileGridSeasonLifecycleInput {
  citySlug: string;
  seasonSlug: string;
  surgeHours: number;
  now: string;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid season lifecycle requires ${label}`);
  }
  return normalized;
}

export async function reconcileGridSeasonLifecycle(
  port: GridSeasonLifecyclePort,
  input: ReconcileGridSeasonLifecycleInput,
) {
  const citySlug = required(input.citySlug, 'citySlug');
  const seasonSlug = required(input.seasonSlug, 'seasonSlug');
  const record = await port.readSeason(citySlug, seasonSlug);
  if (!record) {
    throw new Error('Grid season lifecycle could not resolve the configured season');
  }

  const desiredStatus = deriveGridSeasonLifecycleStatus(
    {
      status: record.status,
      startsAt: record.startsAt,
      surgeStartsAt: record.surgeStartsAt,
      endsAt: record.endsAt,
    },
    input.surgeHours,
    input.now,
  );

  if (desiredStatus === record.status) {
    return {
      seasonId: record.seasonId,
      previousStatus: record.status,
      status: record.status,
      changed: false,
      duplicate: false,
      eventId: null,
      updatedAt: input.now,
    };
  }

  return port.reconcile({
    seasonId: record.seasonId,
    surgeHours: input.surgeHours,
    now: input.now,
  });
}
