/**
 * Canton Quests — Fair QR Hunt domain logic
 * ===========================================
 * Pure, DB-agnostic rules and display math for the Fair QR Hunt Operation.
 * Nothing here talks to Supabase or the local engine directly — callers
 * (API routes, pages, tests) pass in whatever Quest/QuestEvent objects
 * they've already loaded via the normal lib/supabase-db.ts functions.
 *
 * The Fair's per-quest startsAt/expiresAt windows (seeded in
 * supabase/migrations/*_fair_qr_hunt_core_and_bonus_quests.sql and mirrored
 * in lib/seed-data.ts for local/offline use) already fall entirely inside
 * the Fair's own Sept 1–7 America/New_York window, so quest-level
 * availability (lib/quest-rewards.ts getQuestAvailability, enforced in both
 * submission paths) is what actually blocks claims before/after the Fair —
 * no separate event-level gate is needed here.
 */

import { PublicQuestView, Quest, QuestEvent } from './types';

/** The exact placeholder gm_notes value every Fair quest was seeded with — used to detect "no real placement note written yet" for deployment status. */
export const PLACEMENT_NOTE_PLACEHOLDER = 'Placement TBD.';

export const FAIR_EVENT_SLUG = 'fair-qr-hunt';
export const FAIR_TIMEZONE = 'America/New_York';

export const FAIR_CORE_CATEGORY = 'fair_core' as const;
export const FAIR_BONUS_CATEGORY = 'fair_bonus' as const;

export const CORE_QR_COUNT = 20;
export const CORE_QR_POINTS = 100;
export const DAILY_BONUS_POINTS = 300;

/** Canton, Ohio local calendar days the Fair runs, in America/New_York. */
export const FAIR_BONUS_DATES = [
  '2026-09-01',
  '2026-09-02',
  '2026-09-03',
  '2026-09-04',
  '2026-09-05',
  '2026-09-06',
  '2026-09-07',
] as const;

export const DAILY_BONUS_COUNT = FAIR_BONUS_DATES.length;

export const MAX_CORE_SCORE = CORE_QR_COUNT * CORE_QR_POINTS; // 2,000
export const MAX_BONUS_SCORE = DAILY_BONUS_COUNT * DAILY_BONUS_POINTS; // 2,100
export const MAX_FAIR_SCORE = MAX_CORE_SCORE + MAX_BONUS_SCORE; // 4,100

export function fairCoreQuestSlug(index: number): string {
  return `fair-core-${String(index).padStart(2, '0')}`;
}

export function fairBonusQuestSlug(dateKey: string): string {
  return `fair-bonus-${dateKey}`;
}

export function isFairCoreQuest(quest: Pick<Quest | PublicQuestView, 'category'>): boolean {
  return quest.category === FAIR_CORE_CATEGORY;
}

export function isFairBonusQuest(quest: Pick<Quest | PublicQuestView, 'category'>): boolean {
  return quest.category === FAIR_BONUS_CATEGORY;
}

/**
 * Today's date, as a YYYY-MM-DD key, in the Fair's own America/New_York
 * timezone — never derived from a naive UTC slice, which would report the
 * wrong calendar day for several hours around each midnight ET.
 */
export function getFairDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FAIR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export type FairOperationPhase = 'pre_launch' | 'active' | 'ended';

/** The Fair's real-time phase, from the event's own start/end timestamps — not its admin-set `status`, so it transitions automatically at the right instant. */
export function getFairOperationPhase(event: Pick<QuestEvent, 'startTime' | 'endTime'>, now: Date = new Date()): FairOperationPhase {
  const nowMs = now.getTime();
  if (event.startTime && nowMs < new Date(event.startTime).getTime()) return 'pre_launch';
  if (event.endTime && nowMs > new Date(event.endTime).getTime()) return 'ended';
  return 'active';
}

export interface FairDashboardProgress {
  coreFoundCount: number;
  coreTotalCount: number;
  coreScore: number;
  bonusFoundCount: number;
  bonusTotalCount: number;
  bonusScore: number;
  totalFoundCount: number;
  totalScore: number;
  maxScore: number;
}

/**
 * Aggregates a Fair player's progress from the full Fair quest list plus
 * which quest ids they've verified-claimed. Works from PublicQuestView (no
 * targetCode/gmNotes needed) so it's safe to call with whatever the
 * dashboard API already fetched for display.
 */
export function computeFairDashboardProgress(
  fairQuests: Array<Pick<PublicQuestView, 'id' | 'category' | 'pointValue'>>,
  claimedQuestIds: Iterable<string>
): FairDashboardProgress {
  const claimed = claimedQuestIds instanceof Set ? claimedQuestIds : new Set(claimedQuestIds);
  const coreQuests = fairQuests.filter(isFairCoreQuest);
  const bonusQuests = fairQuests.filter(isFairBonusQuest);
  const coreFound = coreQuests.filter((q) => claimed.has(q.id));
  const bonusFound = bonusQuests.filter((q) => claimed.has(q.id));
  const coreScore = coreFound.reduce((sum, q) => sum + (q.pointValue || 0), 0);
  const bonusScore = bonusFound.reduce((sum, q) => sum + (q.pointValue || 0), 0);

  return {
    coreFoundCount: coreFound.length,
    coreTotalCount: coreQuests.length,
    coreScore,
    bonusFoundCount: bonusFound.length,
    bonusTotalCount: bonusQuests.length,
    bonusScore,
    totalFoundCount: coreFound.length + bonusFound.length,
    totalScore: coreScore + bonusScore,
    maxScore: MAX_FAIR_SCORE,
  };
}

export type DeploymentStatus = 'placement_tbd' | 'ready_to_print' | 'placed' | 'disabled';

/**
 * Derived, not stored — a Signal's physical deployment state is computed
 * from three existing/small fields rather than a dedicated status column:
 *   disabled       — quest.status === 'inactive' (overrides everything else)
 *   placed         — placedAt is set (a Commander has confirmed it's out at the Fair)
 *   ready_to_print — a real gm_notes placement note has been written, but not yet marked placed
 *   placement_tbd  — no real placement note yet (still the seed placeholder, or empty)
 */
export function getDeploymentStatus(quest: Pick<Quest, 'status' | 'gmNotes' | 'placedAt'>): DeploymentStatus {
  if (quest.status === 'inactive') return 'disabled';
  if (quest.placedAt) return 'placed';
  const note = (quest.gmNotes || '').trim();
  if (note && note !== PLACEMENT_NOTE_PLACEHOLDER) return 'ready_to_print';
  return 'placement_tbd';
}

export const DEPLOYMENT_STATUS_LABEL: Record<DeploymentStatus, string> = {
  placement_tbd: 'PLACEMENT TBD',
  ready_to_print: 'READY TO PRINT',
  placed: 'PLACED',
  disabled: 'DISABLED',
};
