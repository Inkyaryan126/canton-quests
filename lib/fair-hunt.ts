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
 * the Fair's own Sept 4–5 America/New_York window, so quest-level
 * availability (lib/quest-rewards.ts getQuestAvailability, enforced in both
 * submission paths) is what actually blocks claims before/after the Fair —
 * no separate event-level gate is needed here.
 *
 * REDESIGN (2026-09-01): the old points/XP/leaderboard mechanic (100 pts/
 * Signal, 300 pt daily bonus, 2,600 max score, "$100 to top hunter") is
 * fully retired — see supabase/migrations/20260901130000_fair_mystery_money_hunt.sql.
 * The Fair is now a $300 Mystery Money Hunt across the 20 core Signals
 * only: first authenticated scan globally wins that Signal's hidden cash
 * value, revealed publicly only after the claim. That mechanic's types,
 * constants, and pure display math live below and in the "MYSTERY MONEY"
 * section; the actual claim/board/winners DB logic lives in
 * claimFairMysterySignalDB / getFairMysteryBoardDB / getFairMysteryWinnersDB
 * (lib/supabase-db.ts) and their local-engine mirrors (lib/game-engine.ts) —
 * this file only holds pure, DB-agnostic pieces, same as everything else
 * here.
 */

import { PublicQuestView, Quest, QuestEvent } from './types';

/** The exact placeholder gm_notes value every Fair quest was seeded with — used to detect "no real placement note written yet" for deployment status. */
export const PLACEMENT_NOTE_PLACEHOLDER = 'Placement TBD.';

export const FAIR_EVENT_SLUG = 'fair-qr-hunt';
export const FAIR_TIMEZONE = 'America/New_York';

export const FAIR_CORE_CATEGORY = 'fair_core' as const;
export const FAIR_BONUS_CATEGORY = 'fair_bonus' as const;

export const CORE_QR_COUNT = 20;

/**
 * Canton, Ohio local calendar days the Fair runs, in America/New_York.
 * The daily-bonus Signal concept these dates once drove is retired along
 * with the point system (see module header) — every fair_bonus quest is
 * now status: 'inactive'. Kept here only because the admin console still
 * displays those retired quest rows for historical/ops visibility.
 */
export const FAIR_BONUS_DATES = [
  '2026-09-04',
  '2026-09-05',
] as const;

export const DAILY_BONUS_COUNT = FAIR_BONUS_DATES.length;

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

/* =========================================================================
   $300 MYSTERY MONEY HUNT
   -------------------------------------------------------------------------
   Pure types, constants, and display math only — the actual claim/board/
   winners DB reads and writes (including the global-first-claim race
   safety) live in lib/supabase-db.ts (claimFairMysterySignalDB,
   getFairMysteryBoardDB, getFairMysteryWinnersDB) and their local-engine
   mirrors in lib/game-engine.ts.

   SECURITY: nothing in this file, and no function these types flow
   through, may ever let an unfound Signal's cashCents reach a public
   response. FairMysterySignalPublic's cashCents/claimedAt/finder* fields
   are typed optional specifically so "not present" is the only way an
   unfound Signal is representable — never a zeroed-out or masked value
   that could itself leak information.
   ========================================================================= */

/** The fixed, permanent prize pool — see supabase/migrations/20260901130000_fair_mystery_money_hunt.sql. Never derive this from live data; it's a constant the seeded prizes are checked against. */
export const MYSTERY_TOTAL_POOL_CENTS = 30000; // $300
export const MYSTERY_SIGNAL_COUNT = 20;

/** The approved prize distribution — 6x$5, 4x$10, 4x$15, 3x$20, 2x$30, 1x$50 — documented here for reference; the actual per-Signal assignment lives only in the migration and lib/seed-data.ts's SEED_FAIR_MYSTERY_PRIZES. */
export const MYSTERY_PRIZE_DISTRIBUTION: ReadonlyArray<{ cashCents: number; count: number }> = [
  { cashCents: 500, count: 6 },
  { cashCents: 1000, count: 4 },
  { cashCents: 1500, count: 4 },
  { cashCents: 2000, count: 3 },
  { cashCents: 3000, count: 2 },
  { cashCents: 5000, count: 1 },
];

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** A single Signal as it may ever appear in a PUBLIC response. cashCents/claimedAt/finder* are present if and only if the Signal has been claimed — never populated, zeroed, or masked for an unfound Signal. */
export interface FairMysterySignalPublic {
  questId: string;
  slug: string;
  /** Parsed from the slug, e.g. 7 for "fair-core-07". */
  number: number;
  title: string;
  found: boolean;
  finderDisplayName?: string;
  finderAvatarUrl?: string;
  /** Only present when found === true. */
  cashCents?: number;
  /** Only present when found === true. */
  claimedAt?: string;
}

export interface FairMysteryBoard {
  signals: FairMysterySignalPublic[];
  totalPoolCents: number;
  /** Admin-only aggregate — omitted from public responses to prevent last-signal math deduction leaks. */
  revealedCents?: number;
  /** Admin-only aggregate — omitted from public responses to prevent last-signal math deduction leaks. */
  hiddenCents?: number;
  foundCount: number;
  totalCount: number;
}

/** A player's cumulative Mystery Money winnings — informational only, never a competitive rank ("no additional prize for being #1"). */
export interface FairMysteryWinner {
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  signalsFound: number;
  totalCents: number;
}

export type FairMysteryClaimOutcome = 'won' | 'already_claimed' | 'not_recognized' | 'unavailable' | 'error';

export interface FairMysteryClaimResult {
  outcome: FairMysteryClaimOutcome;
  signal?: { questId: string; slug: string; number: number; title: string };
  /** Present for both 'won' and 'already_claimed' — the amount is public once any claim exists, per the CRITICAL SECURITY RULE (hidden only pre-claim). */
  cashCents?: number;
  /** The display name of whoever actually holds this Signal — present for 'won' (the caller) and 'already_claimed' (the other player). */
  winnerDisplayName?: string;
  message?: string;
}

/** Parses "fair-core-07" -> 7. Returns null for anything else (e.g. a fair_bonus slug). */
export function parseMysterySignalNumber(slug: string): number | null {
  const match = slug.match(/^fair-core-(\d{2})$/);
  return match ? Number(match[1]) : null;
}

/** Pure aggregation used by both the Supabase and local-engine board builders, and directly by tests. */
export function computeMysteryBoardTotals(
  signals: Array<Pick<FairMysterySignalPublic, 'found' | 'cashCents'>>
): { revealedCents: number; hiddenCents: number; foundCount: number } {
  const found = signals.filter((s) => s.found);
  const revealedCents = found.reduce((sum, s) => sum + (s.cashCents || 0), 0);
  return {
    revealedCents,
    hiddenCents: MYSTERY_TOTAL_POOL_CENTS - revealedCents,
    foundCount: found.length,
  };
}
