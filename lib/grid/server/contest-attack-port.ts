import type { GridOfflineDefenseDecisionReason } from '../core/offline-defense-types';

export interface GridContestAttackContextRequest {
  attackerPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
}

export interface GridContestAttackContext {
  seasonId: string;
  cityId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  targetTerritorySlug: string;
}

export interface GridContestAutoRetreatCommand {
  seasonId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  defenseDoctrineId: string;
  defenseReason: GridOfflineDefenseDecisionReason;
  defenseTactic: string;
  idempotencyKey: string;
  now: string;
}

export interface GridContestAutoRetreatResult {
  seasonId: string;
  cityId: string;
  attackerPlayerId: string;
  defenderPlayerId: string;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  capturedAt: string;
  eventId: string;
}

export interface GridContestAttackPort {
  getAttackContext(
    request: GridContestAttackContextRequest,
  ): Promise<GridContestAttackContext>;
  captureByAutoRetreat(
    command: GridContestAutoRetreatCommand,
  ): Promise<GridContestAutoRetreatResult>;
}
