/**
 * Canton Quests — Watchers Foundation
 * ======================================
 * Pure types for the hidden-layer eligibility architecture. No quest
 * content, no puzzle text, no fabricated "final answer" lives here — this
 * is the plumbing a future content pass plugs into, not the content
 * itself. See lib/watchers-db.ts for the actual eligibility checks.
 *
 * "The game may react to GAME ACTIONS only" — every trigger source below
 * names a real, server-verifiable action (a sigil unlock, a role grant, a
 * quest combination), never anything resembling personal surveillance.
 */

export type WatcherTriggerSource =
  | 'THREE_SIGILS'
  | 'QUEST_COMBINATION'
  | 'COMPLETION_ORDER'
  | 'HIDDEN_BADGE'
  | 'PLAYER_INTERACTION'
  | 'NPC_INTERACTION'
  | 'LIVE_EVENT'
  | 'SIGNAL_CARRIER'
  | 'GM_ACTIVATION';

export interface WatcherEligibilityRecord {
  triggerSource: WatcherTriggerSource;
  triggerDetail?: string;
  eligibleAt: string;
}

export interface WatcherStatus {
  isEligible: boolean;
  records: WatcherEligibilityRecord[];
  /** Free-form, private, per-player scratch state for future Watcher content — empty until that content exists. */
  privateClueState: Record<string, unknown>;
}
