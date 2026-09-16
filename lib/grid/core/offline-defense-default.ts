import type { GridOfflineDefensePolicy } from './offline-defense-types';

/**
 * Safe baseline for players who have not customized their doctrine yet.
 * Committed Influence is escrowed, not automatically spent; only contest
 * losses are burned. The default caps exposure at 40 Influence.
 */
export const DEFAULT_GRID_OFFLINE_DEFENSE_POLICY: GridOfflineDefensePolicy = {
  doctrineId: 'balanced-default-v1',
  reserveInfluence: 40,
  maxCommitPerContest: 40,
  defaultCommitBps: 10000,
  autoRetreatBelowInfluence: 9,
  autoRetreatAfterLosses: 0,
  defaultTactic: 'fortify',
  priorityRules: [],
};
