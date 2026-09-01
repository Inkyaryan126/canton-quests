import { describe, it, expect } from 'vitest';
import {
  computeAwardedBonusesForSubmission,
  getBonusLineItems,
  getEffectiveBaseXp,
  getEffectiveDrawingEntries,
  getMaxPossibleXp,
  getQuestRewardSummary,
  getRaceBonusTiers,
  getUnlockSummary,
} from '../lib/quest-rewards';
import { Quest } from '../lib/types';
import { SEED_QUESTS } from '../lib/seed-data';

const baseQuest: Quest = {
  id: 'qst-test',
  eventId: 'evt-test',
  title: 'Test Quest',
  slug: 'test-quest',
  description: '',
  instructions: '',
  pointValue: 100,
  difficulty: 'easy',
  category: 'exploration',
  verificationType: 'checkin',
  proofRequirement: '',
  isFlash: false,
  status: 'active',
  sortOrder: 1,
  createdAt: '2026-08-01T00:00:00Z',
};

describe('Quest reward template (lib/quest-rewards.ts)', () => {
  it('falls back to legacy flat fields for a quest with no rewardConfig at all', () => {
    expect(getEffectiveBaseXp(baseQuest)).toBe(100);
    expect(getEffectiveDrawingEntries(baseQuest)).toBe(1);
    expect(getBonusLineItems(baseQuest)).toEqual([]);
    expect(getRaceBonusTiers(baseQuest)).toEqual([]);
    expect(getMaxPossibleXp(baseQuest)).toBe(100);

    const unlocks = getUnlockSummary(baseQuest);
    expect(unlocks.badgeSlugs).toEqual([]);
    expect(unlocks.collectibleIds).toEqual([]);
    expect(unlocks.secretQuestIds).toEqual([]);
    expect(unlocks.threeLocksFragment).toBeUndefined();
    expect(unlocks.countsTowardFinale).toBe(false);

    expect(getQuestRewardSummary(baseQuest).hasBonusContent).toBe(false);
  });

  it('still respects xpReward and legacy raceRewards when rewardConfig is absent', () => {
    const quest: Quest = {
      ...baseQuest,
      xpReward: 150,
      raceRewards: [{ place: 1, bonusPoints: 40 }],
    };
    expect(getEffectiveBaseXp(quest)).toBe(150);
    expect(getRaceBonusTiers(quest)).toEqual([{ place: 1, bonusPoints: 40 }]);
    expect(getMaxPossibleXp(quest)).toBe(190);
  });

  it('prefers rewardConfig.baseXp and rewardConfig.raceBonus over the legacy fields when both are set', () => {
    const quest: Quest = {
      ...baseQuest,
      pointValue: 100,
      raceRewards: [{ place: 1, bonusPoints: 10 }],
      rewardConfig: {
        baseXp: 300,
        raceBonus: [{ place: 1, bonusPoints: 999 }],
      },
    };
    expect(getEffectiveBaseXp(quest)).toBe(300);
    expect(getRaceBonusTiers(quest)).toEqual([{ place: 1, bonusPoints: 999 }]);
  });

  it('only lists bonus line items that are actually defined and positive', () => {
    const quest: Quest = {
      ...baseQuest,
      rewardConfig: { fieldCheckInBonusXp: 10, nfcBonusXp: 0, photoVideoBonusXp: 20 },
    };
    const items = getBonusLineItems(quest);
    expect(items.map((i) => i.key)).toEqual(['fieldCheckIn', 'photoVideo']);
    expect(items.map((i) => i.xp)).toEqual([10, 20]);
  });

  it('computes maximum possible XP as base + every bonus + the best race tier', () => {
    const quest: Quest = {
      ...baseQuest,
      rewardConfig: {
        baseXp: 200,
        fieldCheckInBonusXp: 10,
        nfcBonusXp: 15,
        photoVideoBonusXp: 20,
        raceBonus: [
          { place: 1, bonusPoints: 100 },
          { place: 2, bonusPoints: 50 },
        ],
      },
    };
    expect(getMaxPossibleXp(quest)).toBe(200 + 10 + 15 + 20 + 100);
  });

  it('surfaces unlocks — badges, collectibles, secret quests, Three Locks fragment, finale flag', () => {
    const quest: Quest = {
      ...baseQuest,
      rewardConfig: {
        badgeUnlockSlugs: ['pathfinder-secret'],
        collectibleUnlockIds: ['col-founder-word'],
        secretQuestUnlockIds: ['qst-hidden-1'],
        threeLocksFragment: { lock: 'word', collectibleId: 'col-founder-word' },
        countsTowardFinale: true,
      },
    };
    const unlocks = getUnlockSummary(quest);
    expect(unlocks.badgeSlugs).toEqual(['pathfinder-secret']);
    expect(unlocks.collectibleIds).toEqual(['col-founder-word']);
    expect(unlocks.secretQuestIds).toEqual(['qst-hidden-1']);
    expect(unlocks.threeLocksFragment).toEqual({ lock: 'word', collectibleId: 'col-founder-word' });
    expect(unlocks.countsTowardFinale).toBe(true);
    expect(getQuestRewardSummary(quest).hasBonusContent).toBe(true);
  });

  it('only awards bonuses whose triggering method actually matches the submission', () => {
    const quest: Quest = {
      ...baseQuest,
      rewardConfig: {
        baseXp: 100,
        fieldCheckInBonusXp: 10,
        nfcBonusXp: 15,
        photoVideoBonusXp: 20,
        raceBonus: [{ place: 1, bonusPoints: 50 }],
      },
    };

    const checkInOnly = computeAwardedBonusesForSubmission(quest, { method: 'checkin' });
    expect(checkInOnly.lineItems.map((i) => i.key)).toEqual(['fieldCheckIn']);
    expect(checkInOnly.bonusXp).toBe(10);
    expect(checkInOnly.raceBonusXp).toBe(0);
    expect(checkInOnly.totalXp).toBe(110);

    const checkInWithNfcAndPlacement = computeAwardedBonusesForSubmission(quest, {
      method: 'checkin',
      usedNfc: true,
      racePlacement: 1,
    });
    expect(checkInWithNfcAndPlacement.lineItems.map((i) => i.key).sort()).toEqual(['fieldCheckIn', 'nfc']);
    expect(checkInWithNfcAndPlacement.raceBonusXp).toBe(50);
    expect(checkInWithNfcAndPlacement.totalXp).toBe(100 + 10 + 15 + 50);

    const photoSubmission = computeAwardedBonusesForSubmission(quest, { method: 'photo' });
    expect(photoSubmission.lineItems.map((i) => i.key)).toEqual(['photoVideo']);

    const unrelatedPassphrase = computeAwardedBonusesForSubmission(quest, { method: 'passphrase' });
    expect(unrelatedPassphrase.lineItems).toEqual([]);
    expect(unrelatedPassphrase.totalXp).toBe(100);
  });

  it('applies drawingEntryBonus on top of the quest drawingEntryReward', () => {
    const quest: Quest = {
      ...baseQuest,
      drawingEntryReward: 2,
      rewardConfig: { drawingEntryBonus: 3 },
    };
    const result = computeAwardedBonusesForSubmission(quest, { method: 'checkin' });
    expect(result.drawingEntries).toBe(5);
  });

  it('demo data: the flash race quest defines a reusable race + bonus reward config', () => {
    const quest = SEED_QUESTS.find((q) => q.id === 'qst-market-square-flash');
    expect(quest).toBeDefined();
    expect(getEffectiveBaseXp(quest!)).toBe(225);
    expect(getRaceBonusTiers(quest!).map((t) => t.place)).toEqual([1, 2, 3]);
    expect(getMaxPossibleXp(quest!)).toBeGreaterThan(225);
    expect(getQuestRewardSummary(quest!).hasBonusContent).toBe(true);
  });

  it('legacy containment: the Silent Court quest no longer grants THE WORD (or any Founder Cipher reward) — Bell Cipher is the sole canonical source', () => {
    const quest = SEED_QUESTS.find((q) => q.id === 'qst-watchers-silent-court');
    expect(quest).toBeDefined();
    const unlocks = getUnlockSummary(quest!);
    expect(unlocks.collectibleIds).not.toContain('col-founder-word');
    expect(unlocks.threeLocksFragment).toBeUndefined();

    const bellQuest = SEED_QUESTS.find((q) => q.id === 'qst-bicentennial-bell-cipher');
    expect(bellQuest?.rewardConfig?.threeLocksFragment).toEqual({ lock: 'word', collectibleId: 'col-founder-word' });
  });
});
