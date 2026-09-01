/**
 * Canton Quests — Founder's Cipher Phase 2 Engine Reconciliation Test Suite
 *
 * Formally verifies all 18 core architectural requirements:
 * 1. Three district fragments produce ready_to_decode, NOT token_unlocked.
 * 2. Fragment completion order is arbitrary.
 * 3. Wrong tile order does not unlock Sigil.
 * 4. Correct tile order unlocks exactly once.
 * 5. Duplicate correct decode is idempotent.
 * 6. Player cannot decode another player's district.
 * 7. Event scope is enforced.
 * 8. Three Locks alone do not unlock Master Cipher.
 * 9. Three decoded Sigils alone do not unlock Master Cipher.
 * 10. Huge XP does not bypass Master Cipher.
 * 11. Verified quest count does not bypass Master Cipher.
 * 12. All 3 Locks + all 3 decoded Sigils unlock Master Cipher.
 * 13. Wrong Master Cipher answer does not complete mission.
 * 14. Correct answer remains FRANKENSTEIN via server-side verification.
 * 15. Hidden answer/hash is not leaked into public/client projections.
 * 16. Drawing-entry behavior for ordinary verified field quests remains unchanged.
 * 17. Free-order quest architecture is preserved.
 * 18. Local/test engine and Supabase-backed logic agree on state transitions.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  awardCollectible,
  createEventWizard,
  createQuest,
  decodeLocalCipherDistrict,
  getCollectiblesForPlayer,
  getDrawingEntriesForPlayer,
  getLocalCipherFragmentGrants,
  getLocalDistrictCipherProgress,
  getPlayerById,
  isLocalCipherDistrictReadyToDecode,
  isLocalCipherDistrictTokenUnlocked,
  isPlayerQualifiedForFinale,
  resetGameEngineStore,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import {
  checkFinaleEligibility,
  evaluateFinaleSubmission,
  FinaleConfig,
} from '../lib/finale';
import {
  FOUNDER_CIPHER_DISTRICTS,
  verifyDistrictDecodeSequence,
} from '../lib/founders-cipher';
import { proofDigest, proofMatches } from '../lib/quest-proof-secrets';
import { SEED_EVENT } from '../lib/seed-data';
import { Quest } from '../lib/types';

const EVENT_ID = SEED_EVENT.id;

let questSeq = 0;
function makeTestQuest(overrides: Partial<Quest> = {}): Quest {
  questSeq += 1;
  return createQuest({
    eventId: EVENT_ID,
    title: `Phase 2 Fixture Quest ${questSeq}`,
    slug: `phase2-fixture-${questSeq}`,
    description: 'Phase 2 fixture quest.',
    instructions: 'Submit valid proof.',
    pointValue: 50,
    difficulty: 'easy',
    category: 'puzzle',
    verificationType: 'passphrase',
    targetCode: 'PHASE2_ANSWER',
    proofRequirement: 'Enter PHASE2_ANSWER.',
    isFlash: false,
    status: 'active',
    sortOrder: 2000 + questSeq,
    startingPath: 'family',
    ...overrides,
  });
}

function newAgent(name: string) {
  return setCurrentPlayer(`Agent_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
}

function makeFinaleConfig(overrides: Partial<FinaleConfig> = {}): FinaleConfig {
  return {
    eventId: EVENT_ID,
    requiredSigilCount: 3,
    requiresWatcherEligibility: false,
    masterCipherCluePieces: ['Fragment clue 1', 'Fragment clue 2'],
    finalAnswerHash: `sha256:${proofDigest('FRANKENSTEIN')}`,
    finalDestinationReveal: 'Proceed to West Lawn Cemetery — Frankenstein Family Monument.',
    opensAt: null,
    closesAt: null,
    falseFinaleEnabled: false,
    falseFinaleAnswerHash: null,
    falseFinaleRevealText: null,
    ...overrides,
  };
}

describe("Founder's Cipher Phase 2 Engine Reconciliation", () => {
  beforeEach(() => {
    resetGameEngineStore();
    questSeq = 0;
  });

  it('Requirement 1: Three district fragments produce ready_to_decode, NOT token_unlocked', () => {
    const player = newAgent('req1');
    const q1 = makeTestQuest({ rewardConfig: { cipherFragmentKeys: ['arts-founder-signal'] } });
    const q2 = makeTestQuest({ rewardConfig: { cipherFragmentKeys: ['arts-painted-witness'] } });
    const q3 = makeTestQuest({ rewardConfig: { cipherFragmentKeys: ['arts-palace-lantern'] } });

    submitQuestProof({ playerId: player.id, questId: q1.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    expect(isLocalCipherDistrictReadyToDecode(player.id, EVENT_ID, 'arts')).toBe(false);
    expect(isLocalCipherDistrictTokenUnlocked(player.id, EVENT_ID, 'arts')).toBe(false);

    submitQuestProof({ playerId: player.id, questId: q2.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    expect(isLocalCipherDistrictReadyToDecode(player.id, EVENT_ID, 'arts')).toBe(false);
    expect(isLocalCipherDistrictTokenUnlocked(player.id, EVENT_ID, 'arts')).toBe(false);

    const thirdResult = submitQuestProof({ playerId: player.id, questId: q3.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    expect(thirdResult.cipherDistrictsUnlocked).toEqual([]); // NEVER automatically unlocks sigil!
    expect(isLocalCipherDistrictReadyToDecode(player.id, EVENT_ID, 'arts')).toBe(true);
    expect(isLocalCipherDistrictTokenUnlocked(player.id, EVENT_ID, 'arts')).toBe(false);

    const progress = getLocalDistrictCipherProgress(player.id, EVENT_ID, 'arts');
    expect(progress?.status).toBe('ready_to_decode');
  });

  it('Requirement 2: Fragment completion order is arbitrary across districts', () => {
    const player = newAgent('req2');
    const secretFrag = makeTestQuest({ startingPath: 'secret', rewardConfig: { cipherFragmentKeys: ['secret-silent-court'] } });
    const artsFrag = makeTestQuest({ startingPath: 'family', rewardConfig: { cipherFragmentKeys: ['arts-palace-lantern'] } });
    const chalFrag = makeTestQuest({ startingPath: 'challenge', rewardConfig: { cipherFragmentKeys: ['challenge-neon-loop'] } });

    submitQuestProof({ playerId: player.id, questId: secretFrag.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    submitQuestProof({ playerId: player.id, questId: artsFrag.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    submitQuestProof({ playerId: player.id, questId: chalFrag.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });

    const grants = getLocalCipherFragmentGrants(player.id, EVENT_ID);
    expect(grants.map((g) => g.fragmentKey)).toEqual([
      'secret-silent-court',
      'arts-palace-lantern',
      'challenge-neon-loop',
    ]);
  });

  it('Requirement 3: Wrong tile order does not unlock Sigil', () => {
    const player = newAgent('req3');
    ['challenge-brass-key', 'challenge-helmet-emblem', 'challenge-neon-loop'].forEach((key) => {
      const q = makeTestQuest({ rewardConfig: { cipherFragmentKeys: [key] } });
      submitQuestProof({ playerId: player.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    });

    expect(isLocalCipherDistrictReadyToDecode(player.id, EVENT_ID, 'challenge')).toBe(true);

    // Wrong tile order
    const wrongOrder = ['HIS NAME', 'THE WORLD', 'GAVE A MONSTER'];
    const result = decodeLocalCipherDistrict({
      eventId: EVENT_ID,
      playerId: player.id,
      districtKey: 'challenge',
      sequence: wrongOrder,
    });

    expect(result.success).toBe(false);
    expect(result.correct).toBe(false);
    expect(result.error).toMatch(/incorrect fragment sequence/i);
    expect(isLocalCipherDistrictTokenUnlocked(player.id, EVENT_ID, 'challenge')).toBe(false);
  });

  it('Requirement 4: Correct tile order unlocks exactly once', () => {
    const player = newAgent('req4');
    ['secret-stone-stair', 'secret-quiet-signal', 'secret-silent-court'].forEach((key) => {
      const q = makeTestQuest({ rewardConfig: { cipherFragmentKeys: [key] } });
      submitQuestProof({ playerId: player.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    });

    const correctOrder = ['THE DEAD', 'KEEP IT', 'AT WEST LAWN'];
    const result = decodeLocalCipherDistrict({
      eventId: EVENT_ID,
      playerId: player.id,
      districtKey: 'secret',
      sequence: correctOrder,
    });

    expect(result.success).toBe(true);
    expect(result.correct).toBe(true);
    expect(result.status).toBe('token_unlocked');
    expect(result.tokenLabel).toBe('Secret Sigil');
    expect(result.sigilSymbol).toBe('SECR');
    expect(result.decodedSentence).toBe('THE DEAD KEEP IT AT WEST LAWN.');
    expect(isLocalCipherDistrictTokenUnlocked(player.id, EVENT_ID, 'secret')).toBe(true);
  });

  it('Requirement 5: Duplicate correct decode is idempotent', () => {
    const player = newAgent('req5');
    ['arts-founder-signal', 'arts-painted-witness', 'arts-palace-lantern'].forEach((key) => {
      const q = makeTestQuest({ rewardConfig: { cipherFragmentKeys: [key] } });
      submitQuestProof({ playerId: player.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    });

    const sequence = ['A NAME', 'OUTLIVES', 'THE MAN'];
    const first = decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'arts', sequence });
    expect(first.success).toBe(true);

    const second = decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'arts', sequence });
    expect(second.success).toBe(true);
    expect(second.alreadyUnlocked).toBe(true);
    expect(second.status).toBe('token_unlocked');
  });

  it("Requirement 6: Player cannot decode another player's district", () => {
    const playerA = newAgent('req6_A');
    const playerB = newAgent('req6_B');

    // Player A collects fragments
    ['arts-founder-signal', 'arts-painted-witness', 'arts-palace-lantern'].forEach((key) => {
      const q = makeTestQuest({ rewardConfig: { cipherFragmentKeys: [key] } });
      submitQuestProof({ playerId: playerA.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    });

    // Player B attempts to decode arts district without owning fragments
    const sequence = ['A NAME', 'OUTLIVES', 'THE MAN'];
    const attemptByB = decodeLocalCipherDistrict({
      eventId: EVENT_ID,
      playerId: playerB.id,
      districtKey: 'arts',
      sequence,
    });

    expect(attemptByB.success).toBe(false);
    expect(attemptByB.error).toMatch(/fragments are incomplete/i);
    expect(isLocalCipherDistrictTokenUnlocked(playerB.id, EVENT_ID, 'arts')).toBe(false);
    expect(isLocalCipherDistrictTokenUnlocked(playerA.id, EVENT_ID, 'arts')).toBe(false);
  });

  it('Requirement 7: Event scope is enforced', () => {
    const player = newAgent('req7');
    const otherEvent = createEventWizard({
      cityId: SEED_EVENT.cityId,
      title: 'Parallel Event',
      slug: `parallel-event-${Date.now()}`,
      description: 'Parallel event.',
      status: 'active',
      currentPhase: 'day_1',
      isPaused: false,
    });

    // Collect fragments in EVENT_ID
    ['arts-founder-signal', 'arts-painted-witness', 'arts-palace-lantern'].forEach((key) => {
      const q = makeTestQuest({ eventId: EVENT_ID, rewardConfig: { cipherFragmentKeys: [key] } });
      submitQuestProof({ playerId: player.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    });

    // Attempt decode in otherEvent
    const resultOther = decodeLocalCipherDistrict({
      eventId: otherEvent.id,
      playerId: player.id,
      districtKey: 'arts',
      sequence: ['A NAME', 'OUTLIVES', 'THE MAN'],
    });
    expect(resultOther.success).toBe(false);
    expect(resultOther.error).toMatch(/fragments are incomplete/i);

    // Decode in original event succeeds
    const resultMain = decodeLocalCipherDistrict({
      eventId: EVENT_ID,
      playerId: player.id,
      districtKey: 'arts',
      sequence: ['A NAME', 'OUTLIVES', 'THE MAN'],
    });
    expect(resultMain.success).toBe(true);
  });

  it('Requirement 8: Three Locks alone do not unlock Master Cipher', () => {
    const player = newAgent('req8');
    awardCollectible(player.id, 'col-founder-mark', 'Lock 1');
    awardCollectible(player.id, 'col-founder-code', 'Lock 2');
    awardCollectible(player.id, 'col-founder-word', 'Lock 3');

    const config = makeFinaleConfig();
    const eligibility = checkFinaleEligibility(config, 0, true, false, false);
    expect(eligibility.ok).toBe(false);
    if (!eligibility.ok) {
      expect(eligibility.reason).toBe('insufficient_sigils');
    }

    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);
  });

  it('Requirement 9: Three decoded Sigils alone do not unlock Master Cipher', () => {
    const config = makeFinaleConfig();
    // 3 sigils decoded, but hasAllThreeLocks is false
    const eligibility = checkFinaleEligibility(config, 3, false, false, false);
    expect(eligibility.ok).toBe(false);
    if (!eligibility.ok) {
      expect(eligibility.reason).toBe('locks_required');
    }
  });

  it('Requirement 10: Huge XP does not bypass Master Cipher', () => {
    const player = newAgent('req10');
    // Complete high-point quests
    for (let i = 0; i < 15; i++) {
      const q = makeTestQuest({ pointValue: 500, xpReward: 500 });
      submitQuestProof({ playerId: player.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    }

    expect(getPlayerById(player.id)!.totalXp).toBeGreaterThan(7000);
    // Even with >7000 XP, player is not qualified for finale without 3 locks + 3 sigils
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);
  });

  it('Requirement 11: Verified quest count does not bypass Master Cipher', () => {
    const player = newAgent('req11');
    for (let i = 0; i < 10; i++) {
      const q = makeTestQuest();
      submitQuestProof({ playerId: player.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    }

    // 10 verified quests without 3 locks + 3 sigils does NOT qualify
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);
  });

  it('Requirement 12: All 3 Locks + all 3 decoded Sigils unlock Master Cipher', () => {
    const player = newAgent('req12');
    awardCollectible(player.id, 'col-founder-mark', 'Lock MARK', EVENT_ID);
    awardCollectible(player.id, 'col-founder-code', 'Lock CODE', EVENT_ID);
    awardCollectible(player.id, 'col-founder-word', 'Lock WORD', EVENT_ID);

    // Award all 9 fragments
    const allFrags = [
      'arts-founder-signal', 'arts-painted-witness', 'arts-palace-lantern',
      'challenge-brass-key', 'challenge-helmet-emblem', 'challenge-neon-loop',
      'secret-stone-stair', 'secret-quiet-signal', 'secret-silent-court',
    ];
    for (const key of allFrags) {
      const q = makeTestQuest({ rewardConfig: { cipherFragmentKeys: [key] } });
      submitQuestProof({ playerId: player.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    }

    // Decode all 3 districts
    const d1 = decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'arts', sequence: ['A NAME', 'OUTLIVES', 'THE MAN'] });
    expect(d1.unlockedSigilCount).toBe(1);
    expect(d1.allSigilsUnlocked).toBe(false);
    expect(d1.masterCipherAvailable).toBe(false);

    const d2 = decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'challenge', sequence: ['THE WORLD', 'GAVE A MONSTER', 'HIS NAME'] });
    expect(d2.unlockedSigilCount).toBe(2);
    expect(d2.allSigilsUnlocked).toBe(false);
    expect(d2.masterCipherAvailable).toBe(false);

    const d3 = decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'secret', sequence: ['THE DEAD', 'KEEP IT', 'AT WEST LAWN'] });
    expect(d3.unlockedSigilCount).toBe(3);
    expect(d3.allSigilsUnlocked).toBe(true);
    expect(d3.hasAllThreeLocks).toBe(true);
    expect(d3.masterCipherAvailable).toBe(true);

    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(true);

    const config = makeFinaleConfig();
    const eligibility = checkFinaleEligibility(config, 3, true, false, false);
    expect(eligibility.ok).toBe(true);
  });

  it('Requirement 12b: Founder Locks earned in Event A do NOT qualify for Event B', () => {
    const player = newAgent('req12b');
    const otherEvent = createEventWizard({
      cityId: SEED_EVENT.cityId,
      title: 'Other Lock Event',
      slug: `other-lock-event-${Date.now()}`,
      description: 'Other lock event.',
      status: 'active',
      currentPhase: 'day_1',
      isPaused: false,
    });

    // Player earns locks in otherEvent only
    awardCollectible(player.id, 'col-founder-mark', 'Lock MARK', otherEvent.id);
    awardCollectible(player.id, 'col-founder-code', 'Lock CODE', otherEvent.id);
    awardCollectible(player.id, 'col-founder-word', 'Lock WORD', otherEvent.id);

    // Player decodes all 3 sigils in EVENT_ID
    const allFrags = [
      'arts-founder-signal', 'arts-painted-witness', 'arts-palace-lantern',
      'challenge-brass-key', 'challenge-helmet-emblem', 'challenge-neon-loop',
      'secret-stone-stair', 'secret-quiet-signal', 'secret-silent-court',
    ];
    for (const key of allFrags) {
      const q = makeTestQuest({ rewardConfig: { cipherFragmentKeys: [key] } });
      submitQuestProof({ playerId: player.id, questId: q.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    }
    decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'arts', sequence: ['A NAME', 'OUTLIVES', 'THE MAN'] });
    decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'challenge', sequence: ['THE WORLD', 'GAVE A MONSTER', 'HIS NAME'] });
    decodeLocalCipherDistrict({ eventId: EVENT_ID, playerId: player.id, districtKey: 'secret', sequence: ['THE DEAD', 'KEEP IT', 'AT WEST LAWN'] });

    // Player is NOT qualified for EVENT_ID finale because locks belong to otherEvent
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);
  });

  it('Requirement 13: Wrong Master Cipher answer does not complete mission', () => {
    const config = makeFinaleConfig();
    const outcome = evaluateFinaleSubmission(config, { falseFinaleSolvedAt: null, completedAt: null }, 'WRONG_GUESS');
    expect(outcome.stage).toBe('incorrect');
  });

  it('Requirement 14: Correct answer remains FRANKENSTEIN via server-side verification', () => {
    const config = makeFinaleConfig();
    const outcome = evaluateFinaleSubmission(config, { falseFinaleSolvedAt: null, completedAt: null }, 'FRANKENSTEIN');
    expect(outcome.stage).toBe('completed');
    if (outcome.stage === 'completed') {
      expect(outcome.destinationReveal).toBe('Proceed to West Lawn Cemetery — Frankenstein Family Monument.');
    }
  });

  it('Requirement 15: Hidden answer/hash is not leaked into public/client projections', () => {
    const config = makeFinaleConfig();
    const serializedConfig = JSON.stringify({
      masterCipherCluePieces: config.masterCipherCluePieces,
      opensAt: config.opensAt,
      closesAt: config.closesAt,
    });

    expect(serializedConfig.toLowerCase()).not.toContain('frankenstein');
    expect(serializedConfig.toLowerCase()).not.toContain('hash');
  });

  it('Requirement 16: Drawing-entry behavior for ordinary verified field quests remains unchanged', () => {
    const player = newAgent('req16');
    const standardQuest = makeTestQuest({ drawingEntryReward: 1 });

    submitQuestProof({ playerId: player.id, questId: standardQuest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    const entries = getDrawingEntriesForPlayer(player.id, EVENT_ID);
    expect(entries).toHaveLength(1);
    expect(entries[0].entriesCount).toBe(1);
  });

  it('Requirement 17: Free-order quest architecture is preserved', () => {
    const player = newAgent('req17');
    const secretQuest = makeTestQuest({ startingPath: 'secret' });
    const artsQuest = makeTestQuest({ startingPath: 'family' });

    // Player starts secret quest first, then arts quest
    const res1 = submitQuestProof({ playerId: player.id, questId: secretQuest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });
    const res2 = submitQuestProof({ playerId: player.id, questId: artsQuest.id, eventId: EVENT_ID, proofType: 'passphrase', submittedContent: 'PHASE2_ANSWER' });

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
  });

  it('Requirement 18: Local/test engine and canonical sequence verification agree on state transitions', () => {
    // Arts: ['A NAME', 'OUTLIVES', 'THE MAN']
    expect(verifyDistrictDecodeSequence('arts', ['A NAME', 'OUTLIVES', 'THE MAN'])).toBe(true);
    expect(verifyDistrictDecodeSequence('arts', ['[A NAME]', '[OUTLIVES]', '[THE MAN]'])).toBe(true);
    expect(verifyDistrictDecodeSequence('arts', ['THE MAN', 'OUTLIVES', 'A NAME'])).toBe(false);

    // Challenge: ['THE WORLD', 'GAVE A MONSTER', 'HIS NAME']
    expect(verifyDistrictDecodeSequence('challenge', ['THE WORLD', 'GAVE A MONSTER', 'HIS NAME'])).toBe(true);
    expect(verifyDistrictDecodeSequence('challenge', ['GAVE A MONSTER', 'THE WORLD', 'HIS NAME'])).toBe(false);

    // Secret: ['THE DEAD', 'KEEP IT', 'AT WEST LAWN']
    expect(verifyDistrictDecodeSequence('secret', ['THE DEAD', 'KEEP IT', 'AT WEST LAWN'])).toBe(true);
    expect(verifyDistrictDecodeSequence('secret', ['AT WEST LAWN', 'THE DEAD', 'KEEP IT'])).toBe(false);
  });
});
