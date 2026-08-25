/**
 * Canton Quests — Entry Token / Prize Drawing Entry Integration Tests
 *
 * Verifies the strict Entry Token rules against the real server-side
 * reward-grant transaction (lib/game-engine.ts's applyQuestRewardGrants —
 * the same logic lib/supabase-db.ts's awardQuestRewardsDB mirrors for
 * production):
 *   - every successfully completed core quest awards exactly 1 Entry Token
 *     (remote completion counts)
 *   - field check-in / photo/video / race bonus / standard NFC never grant
 *     an entry — XP only
 *   - only an explicitly configured rewardConfig.drawingEntryBonus or
 *     rewardConfig.nfcCacheEntryBonus (and only when NFC was actually used)
 *     grants an additional entry
 *   - duplicate/retry submissions never grant a duplicate entry, and
 *     SubmitProofResult.drawingEntriesAwarded always reports exactly what
 *     was newly granted this call — never a blended/inferred figure
 */

import { describe, expect, it } from 'vitest';
import {
  createQuest,
  getDrawingEntriesForPlayer,
  reviewSubmission,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';
import { Quest } from '../lib/types';

const EVENT_ID = SEED_EVENT.id;

function newPlayer(label: string) {
  return setCurrentPlayer(`EntryToken_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '🎟️');
}

let questCounter = 0;
function makeQuest(overrides: Partial<Quest> = {}): Quest {
  questCounter += 1;
  return createQuest({
    eventId: EVENT_ID,
    title: `Entry Token Test Quest ${questCounter}`,
    slug: `entry-token-test-${questCounter}`,
    description: 'x',
    instructions: 'x',
    pointValue: 100,
    difficulty: 'easy',
    category: 'exploration',
    verificationType: 'passphrase',
    targetCode: 'ENTRYTOKEN',
    proofRequirement: 'x',
    isFlash: false,
    status: 'active',
    sortOrder: 999,
    ...overrides,
  });
}

function totalEntriesFor(playerId: string, questId: string): number {
  return getDrawingEntriesForPlayer(playerId, EVENT_ID)
    .filter((e) => e.questId === questId)
    .reduce((sum, e) => sum + e.entriesCount, 0);
}

describe('Every successfully completed core quest awards exactly 1 Entry Token', () => {
  it('a plain quest with no explicit drawingEntryReward grants exactly 1 entry on completion', () => {
    const player = newPlayer('base-completion');
    const quest = makeQuest();

    const result = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'ENTRYTOKEN' });

    expect(result.success).toBe(true);
    expect(result.drawingEntriesAwarded).toBe(1);
    expect(totalEntriesFor(player.id, quest.id)).toBe(1);
  });

  it('remote completion counts as completion and awards the entry the same as any other method', () => {
    const player = newPlayer('remote-completion');
    const quest = makeQuest({
      verificationType: 'checkin',
      targetCode: undefined,
      location: { id: 'loc-fixture', cityId: 'city-fixture', name: 'Fixture', address: '', latitude: 40.0, longitude: -81.0, radiusMeters: 100, isPartner: false },
    });

    const result = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'checkin', userLat: 40.0, userLon: -81.0 });

    expect(result.success).toBe(true);
    expect(result.drawingEntriesAwarded).toBe(1);
  });
});

describe('Field check-in / photo/video / race bonus / standard NFC award XP only — never an entry', () => {
  it('a field check-in bonus (no drawingEntryBonus configured) grants XP but zero new entries', () => {
    const player = newPlayer('field-checkin-xp-only');
    const quest = makeQuest({
      remoteCapable: true,
      location: { id: 'loc-fixture', cityId: 'city-fixture', name: 'Fixture', address: '', latitude: 40.0, longitude: -81.0, radiusMeters: 100, isPartner: false },
      rewardConfig: { baseXp: 100, fieldCheckInBonusXp: 75 },
    });

    const remote = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'ENTRYTOKEN' });
    expect(remote.drawingEntriesAwarded).toBe(1); // base entry only

    const field = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'checkin', userLat: 40.0, userLon: -81.0 });
    expect(field.success).toBe(true);
    expect(field.awardedPoints).toBe(75); // the field bonus XP
    expect(field.drawingEntriesAwarded ?? 0).toBe(0); // no new entry — field bonus is XP only

    expect(totalEntriesFor(player.id, quest.id)).toBe(1); // still just the base entry
  });

  it('a photo/video bonus grants XP but zero new entries', () => {
    const player = newPlayer('photo-bonus-xp-only');
    const quest = makeQuest({
      verificationType: 'photo',
      targetCode: undefined,
      rewardConfig: { baseXp: 100, photoVideoBonusXp: 60 },
    });

    const submitted = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'photo', proofUrl: 'https://example.com/x.jpg' });
    const approved = reviewSubmission(submitted.submission.id, 'verified');

    expect(approved?.awardedPoints).toBe(160); // 100 base + 60 photo bonus
    expect(totalEntriesFor(player.id, quest.id)).toBe(1); // exactly the base entry, no extra for the photo bonus
  });

  it('a race bonus grants XP but zero new entries', () => {
    const quest = makeQuest({
      rewardConfig: { baseXp: 100, raceBonus: [{ place: 1, bonusPoints: 200 }] },
    });
    const player = newPlayer('race-bonus-xp-only');

    const result = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'ENTRYTOKEN' });

    expect(result.awardedPoints).toBe(300); // 100 base + 200 race bonus
    expect(result.drawingEntriesAwarded).toBe(1); // exactly the base entry — the race bonus itself adds nothing
    expect(totalEntriesFor(player.id, quest.id)).toBe(1);
  });

  it('a standard NFC bonus (no nfcCacheEntryBonus configured) grants XP but zero entries, even with usedNfc: true', () => {
    // usedNfc has no real UI trigger yet, but the resolver must still be
    // correct once NFC infrastructure calls submitQuestProof with it set.
    const quest = makeQuest({
      rewardConfig: { baseXp: 100, nfcBonusXp: 50 }, // no nfcCacheEntryBonus — the default (0)
    });
    const player = newPlayer('standard-nfc-xp-only');

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'ENTRYTOKEN',
      usedNfc: true,
    });

    expect(result.awardedPoints).toBe(150); // 100 base + 50 NFC XP
    expect(result.drawingEntriesAwarded).toBe(1); // base entry only — standard NFC never grants an entry
  });
});

describe('Explicit drawingEntryBonus grants an additional, independently-gated entry', () => {
  it('a quest with drawingEntryBonus configured awards base + bonus entries on first completion', () => {
    const quest = makeQuest({ rewardConfig: { baseXp: 100, drawingEntryBonus: 1 } });
    const player = newPlayer('explicit-entry-bonus');

    const result = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'ENTRYTOKEN' });

    expect(result.drawingEntriesAwarded).toBe(2); // 1 base + 1 explicit bonus, granted together on the base call
    expect(totalEntriesFor(player.id, quest.id)).toBe(2);
  });

  it('the bonus entry is granted at most once, even across a duplicate/GM-re-approval retry', () => {
    const quest = makeQuest({
      verificationType: 'photo',
      targetCode: undefined,
      rewardConfig: { baseXp: 100, drawingEntryBonus: 1 },
    });
    const player = newPlayer('explicit-entry-bonus-duplicate');

    const submitted = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'photo', proofUrl: 'https://example.com/x.jpg' });
    const approved = reviewSubmission(submitted.submission.id, 'verified');
    expect(approved?.awardedPoints).toBe(100);
    expect(totalEntriesFor(player.id, quest.id)).toBe(2);

    // Simulate a repeated/concurrent GM approval of the same submission.
    const reapproved = reviewSubmission(submitted.submission.id, 'verified');
    expect(reapproved?.awardedPoints).toBe(0);
    expect(totalEntriesFor(player.id, quest.id)).toBe(2); // unchanged — no duplicate entry
  });
});

describe('Rare NFC cache with an explicit entry bonus ("Founder Cache") — gated on usedNfc, granted once', () => {
  it('grants the cache entry only when the submission actually reports usedNfc, and reports XP/entries separately', () => {
    const quest = makeQuest({
      remoteCapable: true,
      rewardConfig: { baseXp: 100, nfcBonusXp: 250, nfcCacheEntryBonus: 1 }, // "Founder Cache": +250 XP, +1 Entry Token
    });

    // Without usedNfc: only base XP/entry — the cache bonus does not apply.
    const playerA = newPlayer('founder-cache-no-nfc');
    const withoutNfc = submitQuestProof({ playerId: playerA.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'ENTRYTOKEN' });
    expect(withoutNfc.awardedPoints).toBe(100);
    expect(withoutNfc.drawingEntriesAwarded).toBe(1);

    // With usedNfc: base + cache XP together, base + cache entry together — reported as one number each, never blended (350 XP is not conflated with 2 entries).
    const playerB = newPlayer('founder-cache-with-nfc');
    const withNfc = submitQuestProof({
      playerId: playerB.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'ENTRYTOKEN',
      usedNfc: true,
    });
    expect(withNfc.awardedPoints).toBe(350); // 100 base + 250 cache XP
    expect(withNfc.drawingEntriesAwarded).toBe(2); // 1 base + 1 cache entry
    expect(totalEntriesFor(playerB.id, quest.id)).toBe(2);
  });

  it("the cache's entry bonus and a separately-configured drawingEntryBonus are independently gated — one firing does not block the other", () => {
    const quest = makeQuest({
      remoteCapable: true,
      location: { id: 'loc-fixture', cityId: 'city-fixture', name: 'Fixture', address: '', latitude: 40.0, longitude: -81.0, radiusMeters: 100, isPartner: false },
      rewardConfig: { baseXp: 100, fieldCheckInBonusXp: 10, drawingEntryBonus: 1, nfcCacheEntryBonus: 1 },
    });
    const player = newPlayer('independent-entry-gates');

    // Base completion grants the base entry + the unconditional drawingEntryBonus together.
    const base = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'ENTRYTOKEN' });
    expect(base.drawingEntriesAwarded).toBe(2); // 1 base + 1 drawingEntryBonus
    expect(totalEntriesFor(player.id, quest.id)).toBe(2);

    // A later field visit that also happens to report usedNfc claims the
    // still-outstanding cache entry — proving the earlier drawingEntryBonus
    // grant didn't block this independently-keyed one.
    const field = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'checkin',
      userLat: 40.0,
      userLon: -81.0,
      usedNfc: true,
    });
    expect(field.success).toBe(true);
    expect(field.drawingEntriesAwarded).toBe(1); // exactly the new cache entry, not re-granting the base or the earlier bonus
    expect(totalEntriesFor(player.id, quest.id)).toBe(3); // base(1) + drawingEntryBonus(1) + cache(1)
  });
});

describe('SubmitProofResult.drawingEntriesAwarded always reports exactly what was newly granted', () => {
  it('is 0 (never undefined-treated-as-a-real-total) on a retry that grants nothing new', () => {
    const player = newPlayer('retry-reports-zero');
    const quest = makeQuest();

    submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'ENTRYTOKEN' });
    const retry = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'ENTRYTOKEN' });

    expect(retry.success).toBe(false); // blocked by the existing-verified-submission guard before reward logic even runs
    expect(retry.drawingEntriesAwarded ?? 0).toBe(0);
  });

  it('never exceeds the total entries actually persisted in the drawing entry ledger', () => {
    const quest = makeQuest({ rewardConfig: { baseXp: 100, drawingEntryBonus: 2 } });
    const player = newPlayer('never-exceeds-ledger');

    const result = submitQuestProof({ playerId: player.id, questId: quest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'ENTRYTOKEN' });

    expect(result.drawingEntriesAwarded).toBe(totalEntriesFor(player.id, quest.id));
  });
});
