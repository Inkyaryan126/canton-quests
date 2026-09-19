import type { GridSeasonLifecycleStatus } from '../core/season-lifecycle';

export interface GridSeasonLifecycleRecord {
  cityId: string;
  seasonId: string;
  status: GridSeasonLifecycleStatus;
  startsAt: string | null;
  surgeStartsAt: string | null;
  endsAt: string | null;
}

export interface GridSeasonLifecycleTransitionResult {
  seasonId: string;
  previousStatus: GridSeasonLifecycleStatus;
  status: GridSeasonLifecycleStatus;
  changed: boolean;
  duplicate: boolean;
  eventId: string | null;
  updatedAt: string;
}

export interface GridSeasonLifecyclePort {
  readSeason(
    citySlug: string,
    seasonSlug: string,
  ): Promise<GridSeasonLifecycleRecord | null>;
  reconcile(input: {
    seasonId: string;
    surgeHours: number;
    now: string;
  }): Promise<GridSeasonLifecycleTransitionResult>;
}
