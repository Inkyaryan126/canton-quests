import type { GridProgressionEvent } from '../core/progression-events';
import type { GridProgressionSnapshot } from '../core/progression-types';

export interface GridProgressionEventReadPort {
  getSeasonPlayerEvents(seasonId: string, playerId: string): Promise<GridProgressionEvent[]>;
  getLifetimePlayerEvents(playerId: string): Promise<GridProgressionEvent[]>;
}

export interface GridProgressionProjectionSource {
  playerId: string;
  sourceEventCount: number;
  sourceEventFingerprint: string;
  policyFingerprint: string;
  sourceLastEventAt: string | null;
  snapshot: GridProgressionSnapshot;
}

export interface GridSeasonProgressionProjection extends GridProgressionProjectionSource {
  seasonId: string;
}

export interface GridProgressionProjectionWriteResult {
  applied: boolean;
}

export interface GridProgressionProjectionWritePort {
  replaceSeasonProjection(
    projection: GridSeasonProgressionProjection,
  ): Promise<GridProgressionProjectionWriteResult>;
  replaceLifetimeProjection(
    projection: GridProgressionProjectionSource,
  ): Promise<GridProgressionProjectionWriteResult>;
}
