import type { GridContestTactic } from './contest-types';

export interface GridOfflineDefensePriorityRule {
  territorySlug: string;
  priority: number;
  commitBps?: number;
  tactic?: GridContestTactic;
}

export interface GridOfflineDefensePolicy {
  doctrineId: string;
  reserveInfluence: number;
  maxCommitPerContest: number;
  defaultCommitBps: number;
  autoRetreatBelowInfluence: number;
  autoRetreatAfterLosses: number;
  defaultTactic: GridContestTactic;
  priorityRules: GridOfflineDefensePriorityRule[];
}

export interface GridOfflineDefenseContext {
  targetTerritorySlug: string;
  reserveInfluenceAvailable: number;
  currentDefenderInfluence: number;
  cumulativeInfluenceLost: number;
  minimumViableCommit: number;
}

export type GridOfflineDefenseDecisionReason =
  | 'defend'
  | 'retreat-threshold'
  | 'loss-threshold'
  | 'insufficient-reserve';

export interface GridOfflineDefenseDecision {
  action: 'defend' | 'withdraw';
  committedInfluence: number;
  tactic: GridContestTactic;
  priority: number;
  reason: GridOfflineDefenseDecisionReason;
}
