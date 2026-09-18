import type { GridDynamicEventInstance } from '../core/dynamic-event-types';

export interface GridDynamicEventInsertInput {
  seasonSlug: string;
  instance: GridDynamicEventInstance;
  idempotencyKey: string;
}

export interface GridDynamicEventInsertResult {
  instance: GridDynamicEventInstance;
  duplicate: boolean;
}

export interface GridDynamicEventPort {
  listActive(
    citySlug: string,
    seasonSlug: string,
    now: string,
  ): Promise<GridDynamicEventInstance[]>;
  insert(
    input: GridDynamicEventInsertInput,
  ): Promise<GridDynamicEventInsertResult>;
}
