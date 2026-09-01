/**
 * Canton Quests — Live Reward-Granting Transaction Integration Tests
 *
 * Exercises the shared reward-grant transaction (lib/game-engine.ts's
 * applyQuestRewardGrants, invoked from both submitQuestProof and
 * reviewSubmission) against the in-memory engine. This is the same engine
 * used whenever Supabase isn't configured — the exact environment these
 * tests run in — and lib/supabase-db.ts's awardQuestRewardsDB mirrors this
 * logic 1:1 for the real database, resolver-driven by the same
 * lib/quest-rewards.ts helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  createQuest,
  decodeLocalCipherDistrict,
  getAchievementsForPlayer,
  getCollectiblesForPlayer,
  getDrawingEntriesForPlayer,
  getPlayerById,
  isPlayerQualifiedForFinale,
  reviewSubmission,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { Quest } from '../lib/types';

const EVENT_ID = SEED_EVENT.id;

let questCounter = 0;
function makeQuest(overrides: Partial<Quest> = {}): Quest {
  questCounter += 1;
  return createQuest({
    eventId: EVENT_ID,
    title: `Reward Wiring Test Quest ${questCounter}`,
    slug: `reward-wiring-test-${questCounter}`,
    description: 'Test fixture quest.',
    instructions: 'Test fixture quest.',
    pointValue: 100,
    difficulty: 'easy',
    category: 'exploration',
    verificationType: 'passphrase',
    targetCode: 'TESTCODE',
    proofRequirement: 'Enter the test code.',
    isFlash: false,
    status: 'active',
    sortOrder: 999,
    startingPath: 'family',
    ...overrides,
  });
}

function newPlayer(label: string) {
  return setCurrentPlayer(`RewardTest_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '🧪');
}

function submitPassphrase(playerId: string, quest: Quest, code: string = 'TESTCODE') {
  return submitQuestProof({
    playerId,
    questId: quest.id,
    eventId: EVENT_ID,
    proofType: 'passphrase',
    submittedContent: code,
  });
}

describe('Quest reward-grant transaction — legacy quests', () => {
  it('awards flat legacy XP exactly once for a quest with no rewardConfig', () => {
    const player = newPlayer('legacy');
    const quest = makeQuest({ pointValue: 120, xpReward: 120 });

    const result = submitPassphrase(player.id, quest);
    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(120);

    const totalAfterFirst = getPlayerById(player.id)!.totalXp;

    // Retry: quest is already verified — the existing-submission guard blocks it
    // before the reward transaction is ever re-entered.
    const retry = submitPassphrase(player.id, quest);
    expect(retry.success).toBe(false);
    expect(retry.awardedPoints).toBe(0);
    expect(getPlayerById(player.id)!.totalXp).toBe(totalAfterFirst);
  });
});

describe('Quest reward-grant transaction — reward-configured base XP', () => {
  it('awards rewardConfig.baseXp, not the legacy pointValue, without double-counting', () => {
    const player = newPlayer('configured-base');
    const quest = makeQuest({
      pointValue: 50, // legacy value — must NOT be added on top of rewardConfig.baseXp
      rewardConfig: { baseXp: 300 },
    });

    const result = submitPassphrase(player.id, quest);
    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(300);
  });
});

describe('Quest reward-grant transaction — bonus XP', () => {
  it('awards the field check-in bonus only for a checkin submission, not for passphrase', () => {
    const player = newPlayer('checkin-bonus');
    const quest = makeQuest({
      verificationType: 'checkin',
      targetCode: undefined,
      location: { id: 'loc-test', cityId: 'city-test', name: 'Test Loc', address: '', latitude: 40.0, longitude: -81.0, radiusMeters: 100, isPartner: false },
      rewardConfig: { baseXp: 100, fieldCheckInBonusXp: 25 },
    });

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'checkin',
      userLat: 40.0,
      userLon: -81.0,
    });

    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(125); // 100 base + 25 eligible field check-in bonus
  });

  it('does not grant a configured bonus whose triggering condition was not met', () => {
    const player = newPlayer('ineligible-bonus');
    const quest = makeQuest({
      rewardConfig: { baseXp: 100, fieldCheckInBonusXp: 25, photoVideoBonusXp: 40 },
    });

    // Submitted via passphrase — neither the check-in nor photo/video bonus applies.
    const result = submitPassphrase(player.id, quest);
    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(100);
  });

  it('blocks a duplicate bonus grant if the same submission were re-processed', () => {
    const player = newPlayer('bonus-duplicate');
    const quest = makeQuest({
      verificationType: 'photo',
      targetCode: undefined,
      rewardConfig: { baseXp: 100, photoVideoBonusXp: 30 },
    });

    const submitted = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/proof.jpg',
    });
    expect(submitted.success).toBe(true);
    expect(submitted.submission.status).toBe('pending');

    const approved = reviewSubmission(submitted.submission.id, 'verified');
    expect(approved?.awardedPoints).toBe(130); // 100 base + 30 photo/video bonus

    const totalAfterApproval = getPlayerById(player.id)!.totalXp;

    // Re-approving the same already-verified submission must not re-grant anything.
    const reapproved = reviewSubmission(submitted.submission.id, 'verified');
    expect(reapproved?.awardedPoints).toBe(0);
    expect(getPlayerById(player.id)!.totalXp).toBe(totalAfterApproval);
  });
});

describe('Quest reward-grant transaction — race bonus', () => {
  it('awards the correct placement tier and only one tier per player', () => {
    const quest = makeQuest({
      rewardConfig: {
        baseXp: 100,
        raceBonus: [
          { place: 1, bonusPoints: 200 },
          { place: 2, bonusPoints: 125 },
          { place: 3, bonusPoints: 75 },
        ],
      },
    });

    const first = newPlayer('race-1st');
    const r1 = submitPassphrase(first.id, quest);
    expect(r1.awardedPoints).toBe(300); // 100 + 200 for 1st place
    expect(r1.claimPlacement).toBe(1);

    const second = newPlayer('race-2nd');
    const r2 = submitPassphrase(second.id, quest);
    expect(r2.awardedPoints).toBe(225); // 100 + 125 for 2nd place
    expect(r2.claimPlacement).toBe(2);

    const fourth = newPlayer('race-4th-no-tier');
    // 3rd place taken by nobody in this test — jump straight to a 4th claim to
    // prove an out-of-tier placement gets base XP only, no race bonus.
    submitPassphrase(newPlayer('race-3rd').id, quest);
    const r4 = submitPassphrase(fourth.id, quest);
    expect(r4.awardedPoints).toBe(100);
    expect(r4.claimPlacement).toBe(4);
  });

  it('never awards a second race-bonus tier to the same player on a duplicate request', () => {
    const quest = makeQuest({
      rewardConfig: { baseXp: 100, raceBonus: [{ place: 1, bonusPoints: 200 }] },
    });
    const player = newPlayer('race-duplicate');

    const first = submitPassphrase(player.id, quest);
    expect(first.awardedPoints).toBe(300);

    // Direct submission retry is blocked by the existing-verified-submission guard.
    const retry = submitPassphrase(player.id, quest);
    expect(retry.success).toBe(false);
    expect(retry.awardedPoints).toBe(0);
  });
});

describe('Quest reward-grant transaction — drawing entries', () => {
  it('preserves normal quest-completion drawing entries with no rewardConfig at all', () => {
    const player = newPlayer('entries-normal');
    const quest = makeQuest({ drawingEntryReward: 2 });

    submitPassphrase(player.id, quest);
    const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID);
    const total = entries.filter((e) => e.questId === quest.id).reduce((sum, e) => sum + e.entriesCount, 0);
    expect(total).toBe(2);
  });

  it('does not create extra drawing entries from an XP bonus alone', () => {
    const player = newPlayer('entries-no-xp-leak');
    const quest = makeQuest({
      drawingEntryReward: 1,
      verificationType: 'checkin',
      targetCode: undefined,
      location: { id: 'loc-test', cityId: 'city-test', name: 'Test Loc', address: '', latitude: 40.0, longitude: -81.0, radiusMeters: 100, isPartner: false },
      rewardConfig: { baseXp: 100, fieldCheckInBonusXp: 999 }, // large XP bonus, no drawingEntryBonus configured
    });

    submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'checkin',
      userLat: 40.0,
      userLon: -81.0,
    });

    const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID);
    const total = entries.filter((e) => e.questId === quest.id).reduce((sum, e) => sum + e.entriesCount, 0);
    expect(total).toBe(1); // unaffected by the huge XP bonus
  });

  it('creates the configured extra drawing entries only when drawingEntryBonus is explicitly set', () => {
    const player = newPlayer('entries-explicit-bonus');
    const quest = makeQuest({
      drawingEntryReward: 1,
      rewardConfig: { baseXp: 100, drawingEntryBonus: 3 },
    });

    submitPassphrase(player.id, quest);
    const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID);
    const total = entries.filter((e) => e.questId === quest.id).reduce((sum, e) => sum + e.entriesCount, 0);
    expect(total).toBe(4); // 1 base + 3 explicit bonus
  });

  it('does not duplicate drawing entries on a re-approved GM submission', () => {
    const player = newPlayer('entries-gm-duplicate');
    const quest = makeQuest({
      verificationType: 'photo',
      targetCode: undefined,
      drawingEntryReward: 1,
      rewardConfig: { baseXp: 100, drawingEntryBonus: 2 },
    });

    const submitted = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/proof.jpg',
    });
    reviewSubmission(submitted.submission.id, 'verified');
    reviewSubmission(submitted.submission.id, 'verified'); // duplicate approval

    const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID);
    const total = entries.filter((e) => e.questId === quest.id).reduce((sum, e) => sum + e.entriesCount, 0);
    expect(total).toBe(3); // 1 base + 2 bonus, exactly once
  });
});

describe('Quest reward-grant transaction — badges', () => {
  it('grants a configured badge exactly once, safely no-op on repeat acceptance', () => {
    const player = newPlayer('badge');
    const quest = makeQuest({ rewardConfig: { badgeUnlockSlugs: ['pathfinder-family'] } });

    submitPassphrase(player.id, quest);
    const afterFirst = getAchievementsForPlayer(player.id).filter((a) => a.achievementSlug === 'pathfinder-family');
    expect(afterFirst.length).toBe(1);

    // Duplicate direct retry is blocked before rewards re-run — still exactly one badge row.
    submitPassphrase(player.id, quest);
    const afterRetry = getAchievementsForPlayer(player.id).filter((a) => a.achievementSlug === 'pathfinder-family');
    expect(afterRetry.length).toBe(1);
  });
});

describe('Quest reward-grant transaction — collectibles', () => {
  it('grants a configured collectible exactly once', () => {
    const player = newPlayer('collectible');
    const quest = makeQuest({ rewardConfig: { collectibleUnlockIds: ['col-founder-token'] } });

    submitPassphrase(player.id, quest);
    const owned = getCollectiblesForPlayer(player.id).filter((c) => c.collectibleId === 'col-founder-token');
    expect(owned.length).toBe(1);
  });

  it('legacy containment: the qst-watchers-silent-court seed quest no longer carries a THE WORD reward', () => {
    // Phase 3A containment: this legacy quest previously granted col-founder-word
    // directly (bypassing the canonical Bell Cipher source). Its rewardConfig
    // was removed so it can no longer act as an alternate route to THE WORD.
    const seedQuest = SEED_QUESTS.find((q) => q.id === 'qst-watchers-silent-court');
    expect(seedQuest?.rewardConfig).toBeUndefined();
  });

  it('the canonical qst-bicentennial-bell-cipher seed quest is the sole THE WORD source and its structured reward actually grants it', () => {
    const seedQuest = SEED_QUESTS.find((q) => q.id === 'qst-bicentennial-bell-cipher');
    expect(seedQuest?.rewardConfig?.threeLocksFragment).toEqual({ lock: 'word', collectibleId: 'col-founder-word' });

    const player = newPlayer('bell-cipher-word');
    const quest = makeQuest({
      rewardConfig: seedQuest!.rewardConfig,
    });

    submitPassphrase(player.id, quest);
    const owned = getCollectiblesForPlayer(player.id).filter((c) => c.collectibleId === 'col-founder-word');
    expect(owned.length).toBe(1);
  });
});

describe('Quest reward-grant transaction — Three Locks & finale', () => {
  it('grants a Three Locks fragment, blocks duplicate grants, does not auto-qualify on locks alone, and unlocks finale when 3 locks + 3 sigils are present', () => {
    const player = newPlayer('three-locks');

    const markQuest = makeQuest({ rewardConfig: { threeLocksFragment: { lock: 'mark', collectibleId: 'col-founder-mark' } } });
    const codeQuest = makeQuest({ rewardConfig: { threeLocksFragment: { lock: 'code', collectibleId: 'col-founder-code' } } });
    const wordQuest = makeQuest({ rewardConfig: { threeLocksFragment: { lock: 'word', collectibleId: 'col-founder-word' } } });

    submitPassphrase(player.id, markQuest);
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);

    // Duplicate fragment: re-completing the same lock quest is blocked by the
    // existing-submission guard before any re-grant is attempted.
    const dup = submitPassphrase(player.id, markQuest);
    expect(dup.success).toBe(false);
    expect(getCollectiblesForPlayer(player.id).filter((c) => c.collectibleId === 'col-founder-mark').length).toBe(1);

    submitPassphrase(player.id, codeQuest);
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);

    submitPassphrase(player.id, wordQuest);
    const locks = getCollectiblesForPlayer(player.id).map((c) => c.collectibleId);
    expect(locks).toEqual(expect.arrayContaining(['col-founder-mark', 'col-founder-code', 'col-founder-word']));

    // Three Locks alone do NOT qualify for finale!
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);

    // Now collect and decode all three district sigils
    const artsFragments = [
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['arts-founder-signal'] } }),
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['arts-painted-witness'] } }),
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['arts-palace-lantern'] } }),
    ];
    const chalFragments = [
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['challenge-brass-key'] } }),
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['challenge-helmet-emblem'] } }),
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['challenge-neon-loop'] } }),
    ];
    const secrFragments = [
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['secret-stone-stair'] } }),
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['secret-quiet-signal'] } }),
      makeQuest({ rewardConfig: { cipherFragmentKeys: ['secret-silent-court'] } }),
    ];

    [...artsFragments, ...chalFragments, ...secrFragments].forEach((q) => submitPassphrase(player.id, q));

    decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'arts', sequence: ['A NAME', 'OUTLIVES', 'THE MAN'] });
    decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'challenge', sequence: ['THE WORLD', 'GAVE A MONSTER', 'HIS NAME'] });
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false); // 2 sigils decoded + 3 locks -> still false

    decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'secret', sequence: ['THE DEAD', 'KEEP IT', 'AT WEST LAWN'] });
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(true); // 3 sigils decoded + 3 locks -> true!
  });
});

describe('Quest reward-grant transaction — secret quest unlocks', () => {
  it('does not globally activate the unlocked quest — gating stays per-player via prerequisiteQuestId', () => {
    const gateQuest = makeQuest({ rewardConfig: { secretQuestUnlockIds: [] } });
    const secretQuest = makeQuest({ prerequisiteQuestId: gateQuest.id, isSecret: true });

    const unrelatedPlayer = newPlayer('secret-unrelated');
    const blocked = submitPassphrase(unrelatedPlayer.id, secretQuest);
    expect(blocked.success).toBe(false);
    expect(blocked.message).toMatch(/prerequisite is locked/i);

    const qualifiedPlayer = newPlayer('secret-qualified');
    submitPassphrase(qualifiedPlayer.id, gateQuest);
    const unlocked = submitPassphrase(qualifiedPlayer.id, secretQuest);
    expect(unlocked.success).toBe(true);
  });
});

describe('Quest reward-grant transaction — GM manual vs automated path', () => {
  it('routes GM-approved (photo) submissions through the same reward transaction as automated verification', () => {
    const player = newPlayer('gm-parity');
    const quest = makeQuest({
      verificationType: 'photo',
      targetCode: undefined,
      rewardConfig: { baseXp: 150, badgeUnlockSlugs: ['pathfinder-challenge'], collectibleUnlockIds: ['col-founder-token'] },
    });

    const submitted = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/proof.jpg',
    });
    expect(submitted.submission.status).toBe('pending');
    expect(submitted.awardedPoints).toBe(0);

    const approved = reviewSubmission(submitted.submission.id, 'verified');
    expect(approved?.awardedPoints).toBe(150);
    expect(getAchievementsForPlayer(player.id).some((a) => a.achievementSlug === 'pathfinder-challenge')).toBe(true);
    expect(getCollectiblesForPlayer(player.id).some((c) => c.collectibleId === 'col-founder-token')).toBe(true);
  });
});

describe('Quest reward-grant transaction — concurrent / idempotent re-processing', () => {
  it('processing the same submission twice results in exactly one reward set', () => {
    const player = newPlayer('idempotent');
    const quest = makeQuest({
      verificationType: 'photo',
      targetCode: undefined,
      rewardConfig: {
        baseXp: 100,
        photoVideoBonusXp: 20,
        badgeUnlockSlugs: ['pathfinder-secret'],
        collectibleUnlockIds: ['col-founder-token'],
        drawingEntryBonus: 2,
      },
      drawingEntryReward: 1,
    });

    const submitted = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: 'https://example.com/proof.jpg',
    });

    const first = reviewSubmission(submitted.submission.id, 'verified');
    const totalXpAfterFirst = getPlayerById(player.id)!.totalXp;
    const badgeCountAfterFirst = getAchievementsForPlayer(player.id).length;
    const collectibleCountAfterFirst = getCollectiblesForPlayer(player.id).length;
    const entriesAfterFirst = getDrawingEntriesForPlayer(player.id, EVENT_ID)
      .filter((e) => e.questId === quest.id)
      .reduce((sum, e) => sum + e.entriesCount, 0);

    expect(first?.awardedPoints).toBe(120);
    expect(entriesAfterFirst).toBe(3);

    // Simulate a repeated/concurrent GM approval of the same submission.
    const second = reviewSubmission(submitted.submission.id, 'verified');

    expect(second?.awardedPoints).toBe(0);
    expect(getPlayerById(player.id)!.totalXp).toBe(totalXpAfterFirst);
    expect(getAchievementsForPlayer(player.id).length).toBe(badgeCountAfterFirst);
    expect(getCollectiblesForPlayer(player.id).length).toBe(collectibleCountAfterFirst);
    expect(
      getDrawingEntriesForPlayer(player.id, EVENT_ID)
        .filter((e) => e.questId === quest.id)
        .reduce((sum, e) => sum + e.entriesCount, 0)
    ).toBe(entriesAfterFirst);
  });
});
