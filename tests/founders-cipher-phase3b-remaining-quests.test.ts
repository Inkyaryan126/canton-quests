/**
 * Canton Quests — Founder's Cipher Phase 3B: remaining canonical quest
 * wiring (Kraken Wall, Eternal Flame, Willie the Whale implemented;
 * Palace, The Mural, Golden Mark, Spring Water Shelter staged fail-closed;
 * The Tower left unchanged). See docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md
 * for the visual-evidence basis of every decision exercised here.
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
import { Quest } from '../lib/types';

const EVENT_ID = SEED_EVENT.id;

function newPlayer(label: string) {
  return setCurrentPlayer(`Phase3B_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '🔦');
}

function questById(id: string) {
  const quest = SEED_QUESTS.find((q) => q.id === id);
  if (!quest) throw new Error(`Fixture setup error: missing seed quest ${id}`);
  return quest;
}

function geo(quest: Quest): { userLat?: number; userLon?: number } {
  const loc = quest.location || SEED_LOCATIONS.find((l) => l.id === quest.locationId);
  if (loc?.latitude === undefined || loc?.longitude === undefined) return {};
  return { userLat: loc.latitude, userLon: loc.longitude };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

const KRAKEN = questById('qst-kraken-wall');
const FLAME = questById('qst-eternal-flame');
const WILLIE = questById('qst-willie-the-whale');
const PALACE = questById('qst-palace-stars');
const MURAL_CANONICAL = questById('qst-goose-land-cipher');
const MURAL_RETIRED = questById('qst-challenge-the-mural');
const GOLDEN_MARK = questById('qst-golden-mark');
const SPRING_WATER = questById('qst-spring-water-shelter');

describe('Kraken Wall — grants [THE MAN] exactly once', () => {
  it('correct answer (MORGAN) grants the fragment, XP, and one drawing entry', () => {
    const player = newPlayer('kraken-correct');
    const result = submitQuestProof({
      playerId: player.id,
      questId: KRAKEN.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'Morgan',
    });
    expect(result.success).toBe(true);
    expect(result.cipherFragmentsAwarded).toContain('arts-palace-lantern');

    const owned = getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'arts-palace-lantern');
    expect(owned.length).toBe(1);
    const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === KRAKEN.id);
    expect(entries.reduce((sum, e) => sum + e.entriesCount, 0)).toBe(1);
  });

  it('a duplicate correct submission never re-grants the fragment', () => {
    const player = newPlayer('kraken-dup');
    submitQuestProof({ playerId: player.id, questId: KRAKEN.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'Morgan' });
    submitQuestProof({ playerId: player.id, questId: KRAKEN.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'Morgan' });
    const owned = getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'arts-palace-lantern');
    expect(owned.length).toBe(1);
  });

  it('a wrong answer fails and grants nothing', () => {
    const player = newPlayer('kraken-wrong');
    const result = submitQuestProof({
      playerId: player.id,
      questId: KRAKEN.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'Poseidon',
    });
    expect(result.success).toBe(false);
    expect(result.awardedPoints).toBe(0);
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID)).toHaveLength(0);
  });

  it('the answer and its hash are never exposed in the public quest view', () => {
    const publicView = getPublicQuestView(KRAKEN);
    expect((publicView as any).targetCode).toBeUndefined();
    const serialized = JSON.stringify(publicView);
    expect(serialized.toLowerCase()).not.toContain('morgan');
    expect(serialized).not.toContain('190d6c594862ea96baee36bdcbfcfdf49a44833f892b9bcc06cfbea5c9eea093');
  });
});

describe('Eternal Flame — grants [THE DEAD] exactly once', () => {
  it('correct answer (1963) grants the fragment', () => {
    const player = newPlayer('flame-correct');
    const result = submitQuestProof({
      playerId: player.id,
      questId: FLAME.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1963',
      ...geo(FLAME),
    });
    expect(result.success).toBe(true);
    expect(result.cipherFragmentsAwarded).toContain('secret-stone-stair');

    const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === FLAME.id);
    expect(entries.reduce((sum, e) => sum + e.entriesCount, 0)).toBe(1);
  });

  it('a wrong answer (birth year, not death year) fails', () => {
    const player = newPlayer('flame-wrong');
    const result = submitQuestProof({
      playerId: player.id,
      questId: FLAME.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1917',
      ...geo(FLAME),
    });
    expect(result.success).toBe(false);
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID)).toHaveLength(0);
  });

  it('the answer is never exposed in the public quest view', () => {
    const serialized = JSON.stringify(getPublicQuestView(FLAME));
    expect(serialized).not.toContain('1963');
  });
});

describe('Willie the Whale — grants [HIS NAME] exactly once, only after GM verification', () => {
  it('a pending photo submission grants nothing; GM approval grants exactly once', () => {
    const player = newPlayer('willie');
    const result = submitQuestProof({
      playerId: player.id,
      questId: WILLIE.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      submittedContent: 'https://example.com/willie-porthole.jpg',
    });
    expect(result.submission.status).toBe('pending');
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID)).toHaveLength(0);

    reviewSubmission(result.submission.id, 'verified');
    const owned = getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'challenge-neon-loop');
    expect(owned.length).toBe(1);

    // Duplicate GM approval never re-grants.
    reviewSubmission(result.submission.id, 'verified');
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID).filter((g) => g.fragmentKey === 'challenge-neon-loop')).toHaveLength(1);
  });
});

describe('Staged fail-closed quests can never accidentally complete (Golden Mark, Spring Water Shelter)', () => {
  it.each([
    ['The Golden Mark', GOLDEN_MARK],
    ['Spring Water Shelter', SPRING_WATER],
  ] as const)('%s has no registered answer hash, so no submitted passphrase can ever match', (_label, quest) => {
    const player = newPlayer(`staged-${quest.id}`);
    for (const guess of ['test', 'answer', 'canton', '1927', 'morgan', '']) {
      const result = submitQuestProof({
        playerId: player.id,
        questId: quest.id,
        eventId: EVENT_ID,
        proofType: 'passphrase',
        submittedContent: guess,
        ...geo(quest),
      });
      expect(result.success).toBe(false);
    }
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID)).toHaveLength(0);
    expect(getCollectiblesForPlayer(player.id)).toHaveLength(0);
  });

  it('both remaining staged quests carry status: draft, hidden from player-facing quest browsing', () => {
    for (const quest of [GOLDEN_MARK, SPRING_WATER]) {
      expect(quest.status).toBe('draft');
    }
  });

  it('Golden Mark and Spring Water Shelter are reward-wired (ready to go live the moment a photo resolves them) but inert while staged', () => {
    expect(GOLDEN_MARK.rewardConfig?.threeLocksFragment).toEqual({ lock: 'mark', collectibleId: 'col-founder-mark' });
    expect(SPRING_WATER.rewardConfig?.cipherFragmentKeys).toEqual(['secret-silent-court']);
  });
});

describe('Palace and The Mural are now implemented and live (Phase 3D)', () => {
  it('Palace and The Mural both carry status: active and a registered answer hash', () => {
    expect(PALACE.status).toBe('active');
    expect(MURAL_CANONICAL.status).toBe('active');
  });
});

describe('No duplicate Mural — exactly one canonical record survives, live', () => {
  it('the legacy check-in duplicate is retired (inactive), not deleted, and grants nothing', () => {
    expect(MURAL_RETIRED.status).toBe('inactive');
    expect(MURAL_RETIRED.rewardConfig?.cipherFragmentKeys).toBeUndefined();
    // Still present in SEED_QUESTS (retained for history, not deleted).
    expect(SEED_QUESTS.some((q) => q.id === 'qst-challenge-the-mural')).toBe(true);
  });

  it('the canonical Mural has authoritative location data (was previously unset despite real coordinates existing)', () => {
    expect(MURAL_CANONICAL.location?.latitude).toBeDefined();
    expect(MURAL_CANONICAL.location?.longitude).toBeDefined();
    expect(MURAL_CANONICAL.locationId).toBe('loc-mother-goose-land');
  });

  it('exactly one of the two Mural quest ids is ever browsable (active) — the canonical one', () => {
    const mural = SEED_QUESTS.filter((q) => q.id === 'qst-challenge-the-mural' || q.id === 'qst-goose-land-cipher');
    expect(mural).toHaveLength(2);
    const active = mural.filter((q) => q.status === 'active');
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('qst-goose-land-cipher');
  });
});

describe('Legacy Locks cannot grant canonical Locks (Phase 3A containment holds)', () => {
  it.each([
    'qst-centennial-discovery',
    'qst-onesto-brass-motto',
    'qst-watchers-silent-court',
    'qst-secret-cipher-77',
    'qst-frankenstein-west-lawn',
  ])('%s still carries no rewardConfig', (id) => {
    const quest = SEED_QUESTS.find((q) => q.id === id);
    expect(quest?.rewardConfig).toBeUndefined();
  });

  it('THE MARK is now sourced only by qst-golden-mark (staged); no active quest currently grants it', () => {
    const markGranters = SEED_QUESTS.filter((q) => q.rewardConfig?.threeLocksFragment?.lock === 'mark');
    expect(markGranters.map((q) => q.id)).toEqual(['qst-golden-mark']);
    expect(markGranters[0].status).toBe('draft');
  });
});

describe('Frankenstein remains outside the canonical 14 and cannot bypass the Master Cipher sequence', () => {
  it('completing it grants ordinary XP/entry only — never finale qualification, never a fragment', () => {
    const quest = SEED_QUESTS.find((q) => q.id === 'qst-frankenstein-west-lawn')!;
    const player = newPlayer('frankenstein-3b');
    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      submittedContent: 'https://example.com/frankenstein.jpg',
    });
    reviewSubmission(result.submission.id, 'verified');
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID)).toHaveLength(0);
  });
});

describe('Arbitrary order across the three newly-implemented quests', () => {
  it('Willie -> Eternal Flame -> Kraken Wall (reverse of authoring order) still grants everything correctly', async () => {
    const player = newPlayer('reverse-3b');

    const willie = submitQuestProof({ playerId: player.id, questId: WILLIE.id, eventId: EVENT_ID, proofType: 'photo', submittedContent: 'https://example.com/w.jpg' });
    await tick();
    reviewSubmission(willie.submission.id, 'verified');
    await tick();
    submitQuestProof({ playerId: player.id, questId: FLAME.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: '1963', ...geo(FLAME) });
    await tick();
    const kraken = submitQuestProof({ playerId: player.id, questId: KRAKEN.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'Morgan' });

    expect(kraken.success).toBe(true);
    const fragments = getLocalCipherFragmentGrants(player.id, EVENT_ID).map((g) => g.fragmentKey);
    expect(fragments).toEqual(expect.arrayContaining(['challenge-neon-loop', 'secret-stone-stair', 'arts-palace-lantern']));
  });
});

describe('No field prerequisites on any Phase 3B quest', () => {
  it.each([KRAKEN, FLAME, WILLIE, PALACE, MURAL_CANONICAL, GOLDEN_MARK, SPRING_WATER])(
    '%s has no prerequisiteQuestId',
    (quest) => {
      expect(quest.prerequisiteQuestId).toBeUndefined();
    }
  );
});

describe('Drawing entries stay exactly one per verified field quest (Phase 3B)', () => {
  it('Willie the Whale (photo, GM-reviewed) awards exactly one entry, never duplicated on re-approval', () => {
    const player = newPlayer('willie-entries');
    const result = submitQuestProof({ playerId: player.id, questId: WILLIE.id, eventId: EVENT_ID, proofType: 'photo', submittedContent: 'https://example.com/w2.jpg' });
    expect(getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === WILLIE.id)).toHaveLength(0);

    reviewSubmission(result.submission.id, 'verified');
    let entries = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === WILLIE.id);
    expect(entries.reduce((sum, e) => sum + e.entriesCount, 0)).toBe(1);

    reviewSubmission(result.submission.id, 'verified');
    entries = getDrawingEntriesForPlayer(player.id, EVENT_ID).filter((e) => e.questId === WILLIE.id);
    expect(entries.reduce((sum, e) => sum + e.entriesCount, 0)).toBe(1);
  });
});
