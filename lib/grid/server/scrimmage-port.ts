import type { GridScrimmageState } from '../core/scrimmage-types';

export interface GridScrimmageCreateResult {
  created: boolean;
  state: GridScrimmageState | null;
}

export interface GridScrimmageUpdateResult {
  updated: boolean;
  state: GridScrimmageState | null;
}

export interface GridScrimmagePort {
  create(
    state: GridScrimmageState,
  ): Promise<GridScrimmageCreateResult>;

  getById(
    sessionId: string,
  ): Promise<GridScrimmageState | null>;

  getByInviteCode(
    inviteCode: string,
  ): Promise<GridScrimmageState | null>;

  compareAndSwap(
    sessionId: string,
    expectedRevision: number,
    nextState: GridScrimmageState,
  ): Promise<GridScrimmageUpdateResult>;
}
