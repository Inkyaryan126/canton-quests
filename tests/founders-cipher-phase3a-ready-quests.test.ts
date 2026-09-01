/**
 * Canton Quests — Founder's Cipher Phase 3A: READY canonical quest wiring.
 *
 * Exercises the six quests implemented in Phase 3A (Skate Park Check-In,
 * Canton Sign Capture, Draft Lineup, Bell Cipher, Monument Park, The Open
 * Ground) against the real seed data and the shared local-engine reward
 * transaction (the same transaction lib/supabase-db.ts's awardQuestRewardsDB
 * mirrors 1:1 for the real database — see quest-reward-grant-integration.test.ts
 * header). Also proves the five named legacy quests can no longer act as
 * alternate routes to a canonical Lock, fragment, or the finale itself.
 */

import { describe, expect, it } from 'vitest';
import {
  getCollectiblesForPlayer,
  getDrawingEntriesForPlayer,
  getLocalCipherFragmentGrants,
  getPublicQuestView,
  isPlayerQualifiedForFinale,
  reviewSubmission,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_LOCATIONS, SEED_QUESTS } from '../lib/seed-data';
import { FOUNDER_CIPHER_DISTRICTS } from '../lib/founders-cipher';
import { Quest } from '../lib/types';

const EVENT_ID = SEED_EVENT.id;

function newPlayer(label: string) {
  return setCurrentPlayer(`Phase3A_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '🗝️');
}

function questById(id: string) {
  const quest = SEED_QUESTS.find((q) => q.id === id);
  if (!quest) throw new Error(`Fixture setup error: missing seed quest ${id}`);
  return quest;
}

/**
 * GPS-required quests (checkin, or requireLocationVerification) need a
 * matching userLat/userLon. Some seed quests (e.g. qst-challenge-open-ground,
 * qst-9th-street-opening) set `location: undefined` on the quest object
 * itself even though their locationId resolves to a real SEED_LOCATIONS
 * entry with real coordinates — so this looks up by locationId, not the
 * quest's own (possibly-unset) `location` field.
 */
function geo(quest: Quest): { userLat?: number; userLon?: number } {
  const loc = quest.location || SEED_LOCATIONS.find((l) => l.id === quest.locationId);
  if (loc?.latitude === undefined || loc?.longitude === undefined) return {};
  return { userLat: loc.latitude, userLon: loc.longitude };
}

const BELL = questById('qst-bicentennial-bell-cipher');
const CANTON_SIGN = questById('qst-canton-sign-capture');
const DRAFT_LINEUP = questById('qst-nfl-draft-lineup');
const MONUMENT_PARK = questById('qst-mckinley-cipher');
const OPEN_GROUND = questById('qst-challenge-open-ground');
const SKATE_PARK = questById('qst-9th-street-opening');

describe('Canonical fragment key -> canonical phrase agreement (local + DB share this definition)', () => {
  it('the six Phase 3A quests are wired to the exact fragment/Lock keys their canonical district demands', () => {
    const arts = FOUNDER_CIPHER_DISTRICTS.find((d) => d.key === 'arts')!;
    const challenge = FOUNDER_CIPHER_DISTRICTS.find((d) => d.key === 'challenge')!;
    const secret = FOUNDER_CIPHER_DISTRICTS.find((d) => d.key === 'secret')!;

    // A NAME is index 0 of the Arts canonical sequence -> canonicalFragmentKeys[0]
    expect(CANTON_SIGN.rewardConfig?.cipherFragmentKeys).toEqual([arts.canonicalFragmentKeys[0]]);
    expect(arts.canonicalSequence[0]).toBe('A NAME');

    // OUTLIVES is index 1
    expect(DRAFT_LINEUP.rewardConfig?.cipherFragmentKeys).toEqual([arts.canonicalFragmentKeys[1]]);
    expect(arts.canonicalSequence[1]).toBe('OUTLIVES');

    // KEEP IT is Secret index 1
    expect(MONUMENT_PARK.rewardConfig?.cipherFragmentKeys).toEqual([secret.canonicalFragmentKeys[1]]);
    expect(secret.canonicalSequence[1]).toBe('KEEP IT');

    // GAVE A MONSTER is Challenge index 1
    expect(OPEN_GROUND.rewardConfig?.cipherFragmentKeys).toEqual([challenge.canonicalFragmentKeys[1]]);
    expect(challenge.canonicalSequence[1]).toBe('GAVE A MONSTER');

    // Bell grants a Founder Lock, never a district fragment.
    expect(BELL.rewardConfig?.threeLocksFragment).toEqual({ lock: 'word', collectibleId: 'col-founder-word' });
    expect(BELL.rewardConfig?.cipherFragmentKeys).toBeUndefined();

    // Skate Park is a plain check-in with no required Cipher Fragment.
    expect(SKATE_PARK.rewardConfig?.cipherFragmentKeys).toBeUndefined();
    expect(SKATE_PARK.rewardConfig?.threeLocksFragment).toBeUndefined();
  });
});

describe('1-5. Each canonical fragment/Lock is granted exactly once', () => {
  it('Canton Sign Capture grants [A NAME] exactly once', () => {
    const player = newPlayer('canton-sign');
    const result = submitQuestProof({
      playerId: player.id,
      questId: CANTON_SIGN.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      submittedContent: 'https://example.com/canton-sign.jpg',
    });
    reviewSubmission(result.submission.id, 'verified');
    // Duplicate GM re-approval must never re-grant the fragment.
    reviewSubmission(result.submission.id, 'verified');

    const owned = getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'arts-founder-signal');
    expect(owned.length).toBe(1);
  });

  it('Draft Lineup grants [OUTLIVES] exactly once', () => {
    const player = newPlayer('draft-lineup');
    const result = submitQuestProof({
      playerId: player.id,
      questId: DRAFT_LINEUP.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      submittedContent: 'https://example.com/draft-lineup.jpg',
    });
    reviewSubmission(result.submission.id, 'verified');
    reviewSubmission(result.submission.id, 'verified');

    const owned = getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'arts-painted-witness');
    expect(owned.length).toBe(1);
  });

  it('Monument Park grants [KEEP IT] exactly once', () => {
    const player = newPlayer('monument-park');
    const result = submitQuestProof({
      playerId: player.id,
      questId: MONUMENT_PARK.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1897',
      ...geo(MONUMENT_PARK),
    });
    expect(result.success).toBe(true);
    // Duplicate correct resubmission must never re-grant the fragment.
    submitQuestProof({
      playerId: player.id,
      questId: MONUMENT_PARK.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1897',
      ...geo(MONUMENT_PARK),
    });

    const owned = getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'secret-quiet-signal');
    expect(owned.length).toBe(1);
  });

  it('The Open Ground grants [GAVE A MONSTER] exactly once', () => {
    const player = newPlayer('open-ground');
    const result = submitQuestProof({
      playerId: player.id,
      questId: OPEN_GROUND.id,
      eventId: EVENT_ID,
      proofType: 'checkin',
      submittedContent: 'checkin',
      ...geo(OPEN_GROUND),
    });
    expect(result.success).toBe(true);
    submitQuestProof({
      playerId: player.id,
      questId: OPEN_GROUND.id,
      eventId: EVENT_ID,
      proofType: 'checkin',
      submittedContent: 'checkin',
      ...geo(OPEN_GROUND),
    });

    const owned = getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'challenge-helmet-emblem');
    expect(owned.length).toBe(1);
  });

  it('Bell Cipher grants THE WORD Founder Lock exactly once', () => {
    const player = newPlayer('bell');
    const result = submitQuestProof({
      playerId: player.id,
      questId: BELL.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'Janet Weir Creighton',
    });
    expect(result.success).toBe(true);
    expect(result.threeLocksFragmentAwarded).toBe('word');

    submitQuestProof({
      playerId: player.id,
      questId: BELL.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'Janet Weir Creighton',
    });

    const owned = getCollectiblesForPlayer(player.id).filter((c) => c.collectibleId === 'col-founder-word');
    expect(owned.length).toBe(1);
  });

  it('Bell Cipher also accepts the surname-only variant', () => {
    const player = newPlayer('bell-surname');
    const result = submitQuestProof({
      playerId: player.id,
      questId: BELL.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'creighton',
    });
    expect(result.success).toBe(true);
    expect(result.threeLocksFragmentAwarded).toBe('word');
  });
});

describe('6. Skate Park Check-In grants no required Cipher Fragment', () => {
  it('completing Skate Park never produces a cipherFragmentsAwarded entry', () => {
    const player = newPlayer('skate-park');
    const result = submitQuestProof({
      playerId: player.id,
      questId: SKATE_PARK.id,
      eventId: EVENT_ID,
      proofType: 'checkin',
      submittedContent: 'checkin',
      ...geo(SKATE_PARK),
    });
    expect(result.success).toBe(true);
    expect(result.cipherFragmentsAwarded || []).toHaveLength(0);
    expect(result.threeLocksFragmentAwarded).toBeUndefined();
  });
});

describe('7. Arbitrary completion order works for all six', () => {
  // The local/offline in-memory engine mints submission ids from
  // `sub-${Date.now()}` with no uniqueness suffix (unlike player ids, which
  // already append one) — a pre-existing fixture artifact where enough
  // synchronous calls inside one millisecond can collide. It never affects
  // real players (Supabase mints real UUIDs there) and is out of scope to
  // fix engine-wide here, so this test simply guarantees millisecond
  // separation between calls rather than assuming synchronous uniqueness.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

  it('completing the six READY quests in reverse canonical order still grants every fragment/Lock correctly', async () => {
    const player = newPlayer('reverse-order');

    submitQuestProof({ playerId: player.id, questId: SKATE_PARK.id, eventId: EVENT_ID, proofType: 'checkin', submittedContent: 'checkin', ...geo(SKATE_PARK) });
    await tick();
    submitQuestProof({ playerId: player.id, questId: OPEN_GROUND.id, eventId: EVENT_ID, proofType: 'checkin', submittedContent: 'checkin', ...geo(OPEN_GROUND) });
    await tick();
    submitQuestProof({ playerId: player.id, questId: MONUMENT_PARK.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: '1897', ...geo(MONUMENT_PARK) });
    await tick();
    const bell = submitQuestProof({ playerId: player.id, questId: BELL.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'Janet Weir Creighton' });
    await tick();
    const draft = submitQuestProof({ playerId: player.id, questId: DRAFT_LINEUP.id, eventId: EVENT_ID, proofType: 'photo', submittedContent: 'https://example.com/x.jpg' });
    await tick();
    reviewSubmission(draft.submission.id, 'verified');
    await tick();
    const sign = submitQuestProof({ playerId: player.id, questId: CANTON_SIGN.id, eventId: EVENT_ID, proofType: 'photo', submittedContent: 'https://example.com/y.jpg' });
    await tick();
    reviewSubmission(sign.submission.id, 'verified');

    expect(bell.threeLocksFragmentAwarded).toBe('word');
    const fragments = getLocalCipherFragmentGrants(player.id, EVENT_ID).map((g) => g.fragmentKey);
    expect(fragments).toEqual(
      expect.arrayContaining(['arts-founder-signal', 'arts-painted-witness', 'secret-quiet-signal', 'challenge-helmet-emblem'])
    );
  });
});

describe('8. Photo quests wait for required verification before granting a fragment', () => {
  it('Canton Sign Capture grants nothing until the GM verifies the pending photo submission', () => {
    const player = newPlayer('photo-pending');
    const result = submitQuestProof({
      playerId: player.id,
      questId: CANTON_SIGN.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      submittedContent: 'https://example.com/pending.jpg',
    });

    expect(result.success).toBe(true);
    expect(result.submission.status).toBe('pending');
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'arts-founder-signal')).toHaveLength(0);

    reviewSubmission(result.submission.id, 'verified');
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'arts-founder-signal')).toHaveLength(1);
  });
});

describe('9. Bell answer is never exposed publicly', () => {
  it('the public quest view and its serialized JSON never leak the answer, its hash, or accepted variants', () => {
    const publicView = getPublicQuestView(BELL);
    expect((publicView as any).targetCode).toBeUndefined();
    expect((publicView as any).acceptedAnswerVariants).toBeUndefined();

    const serialized = JSON.stringify(publicView);
    expect(serialized.toLowerCase()).not.toContain('creighton');
    expect(serialized.toLowerCase()).not.toContain('sha256:5065d913');
    expect(serialized.toLowerCase()).not.toContain('sha256:0cc4e7ef');
  });

  it('the full public quest roster serialization stays free of the Bell hash across all quests (regression guard)', () => {
    const serialized = JSON.stringify(SEED_QUESTS.map(getPublicQuestView));
    expect(serialized).not.toContain('5065d913e100599dcc32835d834c6b10bdf6044f36562e5308f81491e2d3be35');
  });
});

describe('10. Legacy qst-watchers-silent-court cannot act as an alternate canonical THE WORD route', () => {
  it('carries no rewardConfig at all — it cannot grant THE WORD, any fragment, or the legacy countsTowardFinale bypass, even if completed', () => {
    const quest = SEED_QUESTS.find((q) => q.id === 'qst-watchers-silent-court');
    expect(quest).toBeDefined();
    expect(quest?.rewardConfig).toBeUndefined();
    // Its prerequisite chain (banned for the canonical 14, but pre-existing
    // and outside the canonical roster) is untouched by containment.
    expect(quest?.prerequisiteQuestId).toBe('qst-watchers-first');
  });
});

describe('11. Legacy Frankenstein quest cannot bypass the Master Cipher / final objective sequence', () => {
  it('qst-frankenstein-west-lawn carries no rewardConfig, and completing it never qualifies a player for the finale', () => {
    const quest = SEED_QUESTS.find((q) => q.id === 'qst-frankenstein-west-lawn');
    expect(quest).toBeDefined();
    expect(quest?.rewardConfig).toBeUndefined();

    const player = newPlayer('frankenstein-early');
    const result = submitQuestProof({
      playerId: player.id,
      questId: quest!.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      submittedContent: 'https://example.com/frankenstein.jpg',
    });
    reviewSubmission(result.submission.id, 'verified');

    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID)).toHaveLength(0);
  });
});

describe('12. Drawing entries stay exactly one per verified field quest', () => {
  it.each([
    ['Bell Cipher', BELL, 'passphrase', 'Janet Weir Creighton'],
    ['Monument Park', MONUMENT_PARK, 'passphrase', '1897'],
    ['The Open Ground', OPEN_GROUND, 'checkin', 'checkin'],
    ['Skate Park Check-In', SKATE_PARK, 'checkin', 'checkin'],
  ] as const)('%s awards exactly one drawing entry on verified completion', (_label, quest, proofType, content) => {
    const player = newPlayer(`entries-${quest.id}`);
    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType,
      submittedContent: content,
      ...geo(quest),
    });
    expect(result.success).toBe(true);
    const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === quest.id);
    const total = entries.reduce((sum, e) => sum + e.entriesCount, 0);
    expect(total).toBe(1);
  });

  it('photo quests (Canton Sign, Draft Lineup) award exactly one drawing entry, only once GM-verified', () => {
    for (const quest of [CANTON_SIGN, DRAFT_LINEUP]) {
      const player = newPlayer(`entries-photo-${quest.id}`);
      const result = submitQuestProof({
        playerId: player.id,
        questId: quest.id,
        eventId: EVENT_ID,
        proofType: 'photo',
        submittedContent: 'https://example.com/proof.jpg',
      });
      expect(getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === quest.id)).toHaveLength(0);

      reviewSubmission(result.submission.id, 'verified');
      const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === quest.id);
      const total = entries.reduce((sum, e) => sum + e.entriesCount, 0);
      expect(total).toBe(1);

      // Duplicate GM approval never duplicates the entry.
      reviewSubmission(result.submission.id, 'verified');
      const entriesAfterDup = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === quest.id);
      expect(entriesAfterDup.reduce((sum, e) => sum + e.entriesCount, 0)).toBe(1);
    }
  });
});
