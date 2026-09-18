import type { GridNpcStrongholdConfig } from '../core/npc-stronghold-types';

export interface GridNpcStrongholdRegistrySnapshot {
  citySlug: string;
  seasonSlug: string;
  configs: GridNpcStrongholdConfig[];
  capturedStrongholdIds: string[];
}

export interface GridNpcStrongholdRegistryPort {
  readSnapshot(
    citySlug: string,
    seasonSlug: string,
  ): Promise<GridNpcStrongholdRegistrySnapshot>;
}
