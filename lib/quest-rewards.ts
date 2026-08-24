import { ProofVerificationType, Quest, QuestRaceBonusTier, QuestRewardConfig } from './types';

/**
 * Canton Quests — Reusable Quest Reward Template
 * ================================================
 * A single, generic layer for reading a quest's reward structure. Nothing
 * in this file is specific to any one quest — every function takes a
 * `Quest` and reads whatever `rewardConfig` (or legacy flat fields) that
 * quest happens to populate. A quest with no rewardConfig at all still
 * works correctly: every helper falls back to pointValue/xpReward/
 * raceRewards so existing seed data keeps functioning unchanged.
 *
 * This module is display/config-only — it does not grant rewards. The
 * actual scoring transaction (app/api/game/submit + lib/supabase-db.ts's
 * submitQuestProofDB) still only awards the flat base XP today. Wiring
 * computeAwardedBonusesForSubmission()'s output into that transaction is a
 * separate follow-up since it touches live, prize-eligible scoring.
 */

export type QuestBonusKey = 'fieldCheckIn' | 'nfc' | 'photoVideo';

export interface QuestBonusLineItem {
  key: QuestBonusKey;
  label: string;
  xp: number;
}

export interface QuestUnlockSummary {
  badgeSlugs: string[];
  collectibleIds: string[];
  secretQuestIds: string[];
  threeLocksFragment?: { lock: 'mark' | 'code' | 'word'; collectibleId: string };
  countsTowardFinale: boolean;
}

export interface QuestRewardSummary {
  baseXp: number;
  bonuses: QuestBonusLineItem[];
  raceBonus: QuestRaceBonusTier[];
  drawingEntries: number;
  drawingEntryBonus: number;
  maxXp: number;
  unlocks: QuestUnlockSummary;
  hasBonusContent: boolean;
}

const BONUS_LABELS: Record<QuestBonusKey, string> = {
  fieldCheckIn: 'Field Check-in Bonus',
  nfc: 'NFC Field Cache Bonus',
  photoVideo: 'Photo/Video Bonus',
};

function config(quest: Quest): QuestRewardConfig {
  return quest.rewardConfig || {};
}

/** The base XP for completing a quest's primary verification step. */
export function getEffectiveBaseXp(quest: Quest): number {
  const cfg = config(quest);
  if (typeof cfg.baseXp === 'number') return cfg.baseXp;
  return quest.xpReward ?? quest.pointValue ?? 0;
}

/** The base drawing-ledger entries awarded on verified completion. */
export function getEffectiveDrawingEntries(quest: Quest): number {
  return quest.drawingEntryReward ?? 1;
}

/** Every optional bonus XP path this quest has actually defined (> 0). */
export function getBonusLineItems(quest: Quest): QuestBonusLineItem[] {
  const cfg = config(quest);
  const items: QuestBonusLineItem[] = [];
  const push = (key: QuestBonusKey, xp: number | undefined) => {
    if (xp && xp > 0) items.push({ key, label: BONUS_LABELS[key], xp });
  };
  push('fieldCheckIn', cfg.fieldCheckInBonusXp);
  push('nfc', cfg.nfcBonusXp);
  push('photoVideo', cfg.photoVideoBonusXp);
  return items;
}

/** Placement-based bonus tiers, preferring rewardConfig over the legacy field. */
export function getRaceBonusTiers(quest: Quest): QuestRaceBonusTier[] {
  const cfg = config(quest);
  const tiers = cfg.raceBonus ?? quest.raceRewards ?? [];
  return [...tiers].sort((a, b) => a.place - b.place);
}

/** Extra drawing entries beyond the quest's normal drawingEntryReward. */
export function getDrawingEntryBonus(quest: Quest): number {
  return config(quest).drawingEntryBonus ?? 0;
}

/** Every unlock a completed quest can grant — badges, collectibles, etc. */
export function getUnlockSummary(quest: Quest): QuestUnlockSummary {
  const cfg = config(quest);
  return {
    badgeSlugs: cfg.badgeUnlockSlugs ?? [],
    collectibleIds: cfg.collectibleUnlockIds ?? [],
    secretQuestIds: cfg.secretQuestUnlockIds ?? [],
    threeLocksFragment: cfg.threeLocksFragment,
    countsTowardFinale: Boolean(cfg.countsTowardFinale),
  };
}

/**
 * The ceiling on what a player could earn from this quest in one sitting:
 * base + every stackable bonus + the best available race placement.
 */
export function getMaxPossibleXp(quest: Quest): number {
  const base = getEffectiveBaseXp(quest);
  const bonusTotal = getBonusLineItems(quest).reduce((sum, item) => sum + item.xp, 0);
  const raceTiers = getRaceBonusTiers(quest);
  const bestRaceBonus = raceTiers.length ? Math.max(...raceTiers.map((tier) => tier.bonusPoints)) : 0;
  return base + bonusTotal + bestRaceBonus;
}

/** Assembles everything a UI needs to render a quest's full reward template. */
export function getQuestRewardSummary(quest: Quest): QuestRewardSummary {
  const bonuses = getBonusLineItems(quest);
  const raceBonus = getRaceBonusTiers(quest);
  const unlocks = getUnlockSummary(quest);
  return {
    baseXp: getEffectiveBaseXp(quest),
    bonuses,
    raceBonus,
    drawingEntries: getEffectiveDrawingEntries(quest),
    drawingEntryBonus: getDrawingEntryBonus(quest),
    maxXp: getMaxPossibleXp(quest),
    unlocks,
    hasBonusContent:
      bonuses.length > 0 ||
      raceBonus.length > 0 ||
      getDrawingEntryBonus(quest) > 0 ||
      unlocks.badgeSlugs.length > 0 ||
      unlocks.collectibleIds.length > 0 ||
      unlocks.secretQuestIds.length > 0 ||
      Boolean(unlocks.threeLocksFragment) ||
      unlocks.countsTowardFinale,
  };
}

export interface QuestSubmissionRewardContext {
  /** How the player actually completed/verified the quest. */
  method: ProofVerificationType;
  /** Their placement if this was a race/flash quest with race tiers. */
  racePlacement?: number;
  /** Whether an NFC tag scan was part of this specific submission. */
  usedNfc?: boolean;
}

export interface QuestAwardedBonuses {
  bonusXp: number;
  lineItems: QuestBonusLineItem[];
  raceBonusXp: number;
  totalXp: number;
  drawingEntries: number;
}

/**
 * Given a real submission's context, resolves exactly which of this
 * quest's configured bonuses actually apply — the piece a scoring
 * integration would call to compute what to actually award. Not currently
 * wired into the live submission path (see file header).
 */
export function computeAwardedBonusesForSubmission(
  quest: Quest,
  context: QuestSubmissionRewardContext
): QuestAwardedBonuses {
  const cfg = config(quest);
  const lineItems: QuestBonusLineItem[] = [];

  const isFieldCheckIn = context.method === 'checkin' || context.method === 'gps';
  if (isFieldCheckIn && cfg.fieldCheckInBonusXp) {
    lineItems.push({ key: 'fieldCheckIn', label: BONUS_LABELS.fieldCheckIn, xp: cfg.fieldCheckInBonusXp });
  }
  if (context.usedNfc && cfg.nfcBonusXp) {
    lineItems.push({ key: 'nfc', label: BONUS_LABELS.nfc, xp: cfg.nfcBonusXp });
  }
  const isPhotoVideo = context.method === 'photo' || context.method === 'video';
  if (isPhotoVideo && cfg.photoVideoBonusXp) {
    lineItems.push({ key: 'photoVideo', label: BONUS_LABELS.photoVideo, xp: cfg.photoVideoBonusXp });
  }

  const raceTiers = getRaceBonusTiers(quest);
  const raceTier = context.racePlacement ? raceTiers.find((tier) => tier.place === context.racePlacement) : undefined;
  const raceBonusXp = raceTier?.bonusPoints ?? 0;

  const bonusXp = lineItems.reduce((sum, item) => sum + item.xp, 0);
  const baseXp = getEffectiveBaseXp(quest);

  return {
    bonusXp,
    lineItems,
    raceBonusXp,
    totalXp: baseXp + bonusXp + raceBonusXp,
    drawingEntries: getEffectiveDrawingEntries(quest) + getDrawingEntryBonus(quest),
  };
}
