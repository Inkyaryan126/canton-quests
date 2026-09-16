import type { GridOfflineDefensePolicy } from '../core/offline-defense-types';

export interface GridOfflineDefensePolicyState {
  seasonId: string;
  playerId: string;
  policy: GridOfflineDefensePolicy;
  updatedAt: string;
}

export interface GridSetOfflineDefensePolicyCommand {
  seasonId: string;
  playerId: string;
  policy: GridOfflineDefensePolicy;
  idempotencyKey: string;
  now: string;
}

export interface GridSetOfflineDefensePolicyResult
  extends GridOfflineDefensePolicyState {
  eventId: string;
}

export interface GridOfflineDefensePolicyPort {
  getPolicy(
    seasonId: string,
    playerId: string,
  ): Promise<GridOfflineDefensePolicyState | null>;
  setPolicy(
    command: GridSetOfflineDefensePolicyCommand,
  ): Promise<GridSetOfflineDefensePolicyResult>;
}
