/**
 * Canton Quests — Challenge Sector Content Tests (C1-C4, "The Storybook Sector")
 *
 * Exercises the new Mother Goose Land / 9th Street quest chain against the
 * shared reward-grant transaction (see quest-reward-grant-integration.test.ts
 * for the generic engine coverage) — these tests are specific to the C1-C4
 * content itself: answer-variant matching, the C2 three-observation
 * sequence, C3's distinct reward components, the C4 prerequisite chain and
 * CODE fragment grant, draft-status invisibility, and remoteCapable
 * stacking behavior.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateQuestState,
  createQuest,
  decodeLocalCipherDistrict,
  getCollectiblesForPlayer,
  getDrawingEntriesForPlayer,
  getPlayerById,
  getPublicQuestView,
  isPlayerQualifiedForFinale,
  reviewSubmission,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';

const EVENT_ID = SEED_EVENT.id;

const C1 = SEED_QUESTS.find((q) => q.id === 'qst-challenge-blue-signal')!;
const C2 = SEED_QUESTS.find((q) => q.id === 'qst-challenge-storybook-witness')!;
const C3 = SEED_QUESTS.find((q) => q.id === 'qst-challenge-what-survived')!;
const C4 = SEED_QUESTS.find((q) => q.id === 'qst-challenge-the-lost-page')!;

function newPlayer(label: string) {
  return setCurrentPlayer(`Storybook_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '📖');
}

/** Drives a fresh player through C1 -> C2 -> C3 -> C4 via remote text answers only. */
function completeChainRemotely(playerId: string) {
  submitQuestProof({ playerId, questId: C1.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'whale' });
  submitQuestProof({ playerId, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'detective cat', stepIndex: 0 });
  submitQuestProof({ playerId, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'gingerbread', stepIndex: 1 });
  submitQuestProof({ playerId, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'a wolf', stepIndex: 2 });
  submitQuestProof({ playerId, questId: C3.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'Blue whale' });
  return submitQuestProof({ playerId, questId: C4.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'WHALE-CAT-GINGERBREAD-WOLF' });
}

describe('Challenge sector content — quest data', () => {
  it('all four quests exist, are Challenge-path, and are wired into the prerequisite chain', () => {
    expect(C1).toBeDefined();
    expect(C2).toBeDefined();
    expect(C3).toBeDefined();
    expect(C4).toBeDefined();
    expect([C1, C2, C3, C4].every((q) => q.startingPath === 'challenge')).toBe(true);
    expect(C2.prerequisiteQuestId).toBe(C1.id);
    expect(C3.prerequisiteQuestId).toBe(C2.id);
    expect(C4.prerequisiteQuestId).toBe(C3.id);
    expect([C1, C2, C3, C4].every((q) => q.remoteCapable)).toBe(true);
  });

  it('do not invent coordinates — location is unset pending owner field verification', () => {
    expect([C1, C2, C3, C4].every((q) => q.location === undefined)).toBe(true);
  });
});

describe('C1 — The Blue Signal: remote answer variants', () => {
  it('accepts "whale", "blue whale", and "a whale" as equivalent answers', () => {
    for (const answer of ['whale', 'blue whale', 'a whale', 'BLUE WHALE']) {
      const player = newPlayer('c1-variant');
      const result = submitQuestProof({
        playerId: player.id,
        questId: C1.id,
        eventId: EVENT_ID,
        proofType: 'passphrase',
        submittedContent: answer,
      });
      expect(result.success).toBe(true);
      expect(result.awardedPoints).toBe(150);
    }
  });

  it('rejects an unrelated answer', () => {
    const player = newPlayer('c1-wrong');
    const result = submitQuestProof({
      playerId: player.id,
      questId: C1.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'dragon',
    });
    expect(result.success).toBe(false);
    expect(result.awardedPoints).toBe(0);
  });
});

describe('C2 — Storybook Witness: three observations required', () => {
  it('requires all three correct observations before awarding anything', () => {
    const player = newPlayer('c2-sequence');
    submitQuestProof({ playerId: player.id, questId: C1.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'whale' });

    const step1 = submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'cat detective', stepIndex: 0 });
    expect(step1.success).toBe(true);
    expect(step1.isQuestFullyCompleted).toBe(false);
    expect(step1.awardedPoints).toBe(0);

    const step2 = submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'gingerbread person', stepIndex: 1 });
    expect(step2.success).toBe(true);
    expect(step2.isQuestFullyCompleted).toBe(false);
    expect(step2.awardedPoints).toBe(0);

    const step3 = submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'wolf', stepIndex: 2 });
    expect(step3.success).toBe(true);
    expect(step3.isQuestFullyCompleted).toBe(true);
    expect(step3.awardedPoints).toBe(200);
  });

  it('rejects an out-of-sequence or incorrect observation', () => {
    const player = newPlayer('c2-wrong-observation');
    submitQuestProof({ playerId: player.id, questId: C1.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'whale' });

    const wrong = submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'not a cat', stepIndex: 0 });
    expect(wrong.success).toBe(false);
  });

  it('is blocked until C1 is completed', () => {
    const player = newPlayer('c2-no-prereq');
    const result = submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'cat', stepIndex: 0 });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/prerequisite is locked/i);
  });
});

describe('C3 — What Survived: base/field/photo/NFC rewards are distinct components', () => {
  it('awards only base XP on a correct remote answer', () => {
    const player = newPlayer('c3-remote-only');
    submitQuestProof({ playerId: player.id, questId: C1.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'whale' });
    submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'cat', stepIndex: 0 });
    submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'gingerbread', stepIndex: 1 });
    submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'wolf', stepIndex: 2 });

    const result = submitQuestProof({ playerId: player.id, questId: C3.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'Blue whale' });
    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(175); // base only — no field checkin/photo/NFC signal present
  });

  it('rewardConfig defines four distinct, differently-valued components', () => {
    const cfg = C3.rewardConfig!;
    expect(cfg.baseXp).toBe(175);
    expect(cfg.fieldCheckInBonusXp).toBe(125);
    expect(cfg.photoVideoBonusXp).toBe(75);
    expect(cfg.nfcBonusXp).toBe(50);
    // All four amounts are distinct from one another (proves they're separate, not aliases of one value).
    const values = [cfg.baseXp, cfg.fieldCheckInBonusXp, cfg.photoVideoBonusXp, cfg.nfcBonusXp];
    expect(new Set(values).size).toBe(4);
  });
});

describe('C4 — The Lost Page: prerequisite chain and single CODE grant', () => {
  it('is blocked without completing C3 first (which transitively requires C1 and C2)', () => {
    const player = newPlayer('c4-no-prereq');
    const result = submitQuestProof({
      playerId: player.id,
      questId: C4.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'WHALE-CAT-GINGERBREAD-WOLF',
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/prerequisite is locked/i);
  });

  it('rejects a partial chain (C1 + C2 only, no C3)', () => {
    const player = newPlayer('c4-partial-chain');
    submitQuestProof({ playerId: player.id, questId: C1.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'whale' });
    submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'cat', stepIndex: 0 });
    submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'gingerbread', stepIndex: 1 });
    submitQuestProof({ playerId: player.id, questId: C2.id, eventId: EVENT_ID, proofType: 'multi_step', submittedContent: 'wolf', stepIndex: 2 });

    const result = submitQuestProof({ playerId: player.id, questId: C4.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'WHALE-CAT-GINGERBREAD-WOLF' });
    expect(result.success).toBe(false);
  });

  it('legacy containment (Phase 3E): completing the full C1->C2->C3->C4 chain grants ordinary XP but NEVER col-founder-code — THE CODE\'s sole intended source is The Tower, not this draft chain', () => {
    const player = newPlayer('c4-full-chain');
    const result = completeChainRemotely(player.id);

    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(300);
    expect(result.collectibleAwarded).toBeUndefined();
    expect(result.threeLocksFragmentAwarded).toBeUndefined();

    const codeOwned = getCollectiblesForPlayer(player.id).filter((c) => c.collectibleId === 'col-founder-code');
    expect(codeOwned).toHaveLength(0);

    // GM re-approval of the same submission (simulating a duplicate/concurrent
    // request) must never grant anything new either.
    reviewSubmission(result.submission.id, 'verified');
    const codeOwnedAfterRetry = getCollectiblesForPlayer(player.id).filter((c) => c.collectibleId === 'col-founder-code');
    expect(codeOwnedAfterRetry).toHaveLength(0);
  });
});

describe('Three Locks + three Sigils gate the finale (CODE via an isolated fixture — Phase 3E: the real C1-C4 chain no longer grants any Lock, see containment test above)', () => {
  it('MARK + CODE + WORD grant all three locks; finale requires all 3 locks AND all 3 decoded sigils', () => {
    const player = newPlayer('three-locks-code');

    // Grant MARK and CODE via fixture quests carrying the exact same
    // threeLocksFragment shape used by production content (matching the
    // pattern already used for WORD below) — CODE's real canonical source
    // is The Tower (not yet implemented; see
    // docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md), so a fixture stands in
    // for it here rather than relying on the now-contained C1-C4 chain.
    const markFixture = createQuest({
      ...C1,
      title: 'MARK fixture',
      slug: `mark-fixture-${Date.now()}`,
      targetCode: 'MARKFIXTURE',
      acceptedAnswerVariants: undefined,
      prerequisiteQuestId: undefined,
      rewardConfig: { threeLocksFragment: { lock: 'mark', collectibleId: 'col-founder-mark' } },
    });
    submitQuestProof({ playerId: player.id, questId: markFixture.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'MARKFIXTURE' });

    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);

    // Still exercise the real C1->C2->C3->C4 chain mechanically (proves it
    // completes cleanly) — but per the containment test above, it grants no
    // Lock, so CODE is granted via an isolated fixture instead.
    const chainResult = completeChainRemotely(player.id);
    expect(chainResult.success).toBe(true);
    expect(chainResult.collectibleAwarded).toBeUndefined();

    const codeFixture = createQuest({
      ...C1,
      title: 'CODE fixture',
      slug: `code-fixture-${Date.now()}`,
      targetCode: 'CODEFIXTURE',
      acceptedAnswerVariants: undefined,
      prerequisiteQuestId: undefined,
      rewardConfig: { threeLocksFragment: { lock: 'code', collectibleId: 'col-founder-code' } },
    });
    const codeResult = submitQuestProof({ playerId: player.id, questId: codeFixture.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'CODEFIXTURE' });
    expect(codeResult.collectibleAwarded?.id).toBe('col-founder-code');
    expect(codeResult.threeLocksFragmentAwarded).toBe('code');
    expect(codeResult.threeLocksOwned).toEqual({ mark: true, code: true, word: false });

    // WORD still outstanding — checked at the fragment-ownership level
    const owned = getCollectiblesForPlayer(player.id).map((c) => c.collectibleId);
    expect(owned).toEqual(expect.arrayContaining(['col-founder-mark', 'col-founder-code']));
    expect(owned).not.toContain('col-founder-word');

    // Now grant WORD via a fixture and confirm 3 locks alone do NOT qualify
    const wordFixture = createQuest({
      ...C1,
      title: 'WORD fixture',
      slug: `word-fixture-${Date.now()}`,
      targetCode: 'WORDFIXTURE',
      acceptedAnswerVariants: undefined,
      prerequisiteQuestId: undefined,
      rewardConfig: { threeLocksFragment: { lock: 'word', collectibleId: 'col-founder-word' } },
    });
    const wordResult = submitQuestProof({ playerId: player.id, questId: wordFixture.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'WORDFIXTURE' });
    expect(wordResult.threeLocksOwned).toEqual({ mark: true, code: true, word: true });

    // In Founder's Cipher, 3 Locks alone do NOT grant finale access!
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);

    // Collect all district fragments
    const artsFragments = [
      createQuest({ eventId: EVENT_ID, title: 'AF1', slug: `af1-${Date.now()}`, description: '', instructions: '', pointValue: 10, difficulty: 'easy', category: 'puzzle', verificationType: 'passphrase', targetCode: 'OK', proofRequirement: '', isFlash: false, status: 'active', sortOrder: 900, rewardConfig: { cipherFragmentKeys: ['arts-founder-signal'] } }),
      createQuest({ eventId: EVENT_ID, title: 'AF2', slug: `af2-${Date.now()}`, description: '', instructions: '', pointValue: 10, difficulty: 'easy', category: 'puzzle', verificationType: 'passphrase', targetCode: 'OK', proofRequirement: '', isFlash: false, status: 'active', sortOrder: 901, rewardConfig: { cipherFragmentKeys: ['arts-painted-witness'] } }),
      createQuest({ eventId: EVENT_ID, title: 'AF3', slug: `af3-${Date.now()}`, description: '', instructions: '', pointValue: 10, difficulty: 'easy', category: 'puzzle', verificationType: 'passphrase', targetCode: 'OK', proofRequirement: '', isFlash: false, status: 'active', sortOrder: 902, rewardConfig: { cipherFragmentKeys: ['arts-palace-lantern'] } }),
    ];
    const chalFragments = [
      createQuest({ eventId: EVENT_ID, title: 'CF1', slug: `cf1-${Date.now()}`, description: '', instructions: '', pointValue: 10, difficulty: 'easy', category: 'puzzle', verificationType: 'passphrase', targetCode: 'OK', proofRequirement: '', isFlash: false, status: 'active', sortOrder: 903, rewardConfig: { cipherFragmentKeys: ['challenge-brass-key'] } }),
      createQuest({ eventId: EVENT_ID, title: 'CF2', slug: `cf2-${Date.now()}`, description: '', instructions: '', pointValue: 10, difficulty: 'easy', category: 'puzzle', verificationType: 'passphrase', targetCode: 'OK', proofRequirement: '', isFlash: false, status: 'active', sortOrder: 904, rewardConfig: { cipherFragmentKeys: ['challenge-helmet-emblem'] } }),
      createQuest({ eventId: EVENT_ID, title: 'CF3', slug: `cf3-${Date.now()}`, description: '', instructions: '', pointValue: 10, difficulty: 'easy', category: 'puzzle', verificationType: 'passphrase', targetCode: 'OK', proofRequirement: '', isFlash: false, status: 'active', sortOrder: 905, rewardConfig: { cipherFragmentKeys: ['challenge-neon-loop'] } }),
    ];
    const secrFragments = [
      createQuest({ eventId: EVENT_ID, title: 'SF1', slug: `sf1-${Date.now()}`, description: '', instructions: '', pointValue: 10, difficulty: 'easy', category: 'puzzle', verificationType: 'passphrase', targetCode: 'OK', proofRequirement: '', isFlash: false, status: 'active', sortOrder: 906, rewardConfig: { cipherFragmentKeys: ['secret-stone-stair'] } }),
      createQuest({ eventId: EVENT_ID, title: 'SF2', slug: `sf2-${Date.now()}`, description: '', instructions: '', pointValue: 10, difficulty: 'easy', category: 'puzzle', verificationType: 'passphrase', targetCode: 'OK', proofRequirement: '', isFlash: false, status: 'active', sortOrder: 907, rewardConfig: { cipherFragmentKeys: ['secret-quiet-signal'] } }),
      createQuest({ eventId: EVENT_ID, title: 'SF3', slug: `sf3-${Date.now()}`, description: '', instructions: '', pointValue: 10, difficulty: 'easy', category: 'puzzle', verificationType: 'passphrase', targetCode: 'OK', proofRequirement: '', isFlash: false, status: 'active', sortOrder: 908, rewardConfig: { cipherFragmentKeys: ['secret-silent-court'] } }),
    ];
    [...artsFragments, ...chalFragments, ...secrFragments].forEach((q) =>
      submitQuestProof({ playerId: player.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'OK' })
    );

    decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'arts', sequence: ['A NAME', 'OUTLIVES', 'THE MAN'] });
    decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'challenge', sequence: ['THE WORLD', 'GAVE A MONSTER', 'HIS NAME'] });
    decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'secret', sequence: ['THE DEAD', 'KEEP IT', 'AT WEST LAWN'] });

    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(true);
  });
});

describe('Challenge quests are not path-exclusive', () => {
  it('a player who never selected the Challenge starting path can still complete C1', () => {
    const player = newPlayer('non-challenge-path');
    expect(getPlayerById(player.id)?.selectedStartingPath).not.toBe('challenge');

    const result = submitQuestProof({
      playerId: player.id,
      questId: C1.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'whale',
    });
    expect(result.success).toBe(true);
  });
});

describe('Draft Challenge quests do not accidentally appear live', () => {
  it('calculateQuestState reports every C1-C4 quest as hidden while status is draft', () => {
    for (const quest of [C1, C2, C3, C4]) {
      expect(quest.status).toBe('draft');
      expect(calculateQuestState(quest, [], [])).toBe('hidden');
    }
  });

  it('the public quest view never leaks target answers for draft Challenge quests', () => {
    const publicViews = [C1, C2, C3, C4].map(getPublicQuestView);
    const serialized = JSON.stringify(publicViews);
    expect(serialized).not.toContain('targetCode');
    expect(serialized).not.toContain('acceptedAnswerVariants');
    expect(serialized).not.toContain('sha256:c1e524f5325e090e0c4b6d2025b3b73eb6ea4608bd1f42c55d580db5480eaeac');
  });
});

describe('Remote completion does not consume later field bonus eligibility', () => {
  it('completing C1 remotely still leaves the field check-in bonus grantable on a later field visit', () => {
    const player = newPlayer('remote-then-field');

    const remote = submitQuestProof({
      playerId: player.id,
      questId: C1.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'whale',
    });
    expect(remote.success).toBe(true);
    expect(remote.awardedPoints).toBe(150); // base only — field bonus not yet claimed

    const totalXpAfterRemote = getPlayerById(player.id)!.totalXp;

    // A later, genuine field visit — same quest, different proof type, after
    // the quest is already verified. remoteCapable lets this through instead
    // of being blocked as "quest already completed".
    const field = submitQuestProof({
      playerId: player.id,
      questId: C1.id,
      eventId: EVENT_ID,
      proofType: 'checkin',
      userLat: 40.8055,
      userLon: -81.3862,
    });

    // No coordinates are configured on this draft quest yet, so the field
    // check-in itself correctly fails closed (missing authoritative
    // location) rather than silently granting the bonus — but critically,
    // it fails for THAT reason, not because the quest was "already done".
    expect(field.success).toBe(false);
    expect(field.message).not.toMatch(/already completed/i);
    expect(field.message).toMatch(/location/i);
    expect(getPlayerById(player.id)!.totalXp).toBe(totalXpAfterRemote);
  });

  it('a remoteCapable quest with a configured location grants the field bonus on a genuine later visit, without re-granting the base', () => {
    const player = newPlayer('remote-then-field-with-location');
    // Exercise the mechanism generically against a location-bearing copy of
    // C1's config, since the real seed quest has no coordinates yet.
    const locatedQuest = createQuest({
      ...C1,
      title: 'C1 (location fixture)',
      slug: `c1-fixture-${Date.now()}`,
      targetCode: 'C1FIXTURE',
      acceptedAnswerVariants: undefined,
      location: { id: 'loc-fixture', cityId: 'city-fixture', name: 'Fixture', address: '', latitude: 40.8055, longitude: -81.3862, radiusMeters: 100, isPartner: false },
    });

    const remote = submitQuestProof({ playerId: player.id, questId: locatedQuest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'C1FIXTURE' });
    expect(remote.awardedPoints).toBe(150);

    const field = submitQuestProof({
      playerId: player.id,
      questId: locatedQuest.id,
      eventId: EVENT_ID,
      proofType: 'checkin',
      userLat: 40.8055,
      userLon: -81.3862,
    });
    expect(field.success).toBe(true);
    expect(field.awardedPoints).toBe(75); // field check-in bonus only, base not re-granted

    const totalDrawingEntries = getDrawingEntriesForPlayer(player.id, EVENT_ID)
      .filter((e) => e.questId === locatedQuest.id)
      .reduce((sum, e) => sum + e.entriesCount, 0);
    expect(totalDrawingEntries).toBe(1); // unaffected — no drawingEntryBonus configured on C1
  });
});
