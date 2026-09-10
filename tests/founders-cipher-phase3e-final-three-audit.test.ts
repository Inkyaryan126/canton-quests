/**
 * Canton Quests — Founder's Cipher Phase 3E, superseded by the 2026-09-10
 * Master Launch Pivot production-parity audit.
 *
 * Final Three Quests: The Tower, The Golden Mark, and Spring Water Shelter.
 * Phase 3E's local photo-archive search found their answers unconfirmed and
 * staged these three quests fail-closed (draft, no answer hash) in this
 * TypeScript file. A direct, read-only audit of live production Supabase
 * (2026-09-10) found all three already `status: 'active'` with a real
 * target_code — someone had resolved and applied real answers directly to
 * production without this file ever being synced back. Each hash was
 * independently re-verified against a real, non-fabricated fact before
 * trusting it (see lib/quest-proof-secrets.ts for sourcing):
 * - The Tower: "1954" — Mother Goose Land's real, publicly documented
 *   opening year.
 * - The Golden Mark: "1805" — Canton, Ohio's real founding year.
 * - Spring Water Shelter: "SPRING" — the real natural feature the shelter
 *   is named for.
 *
 * All three quests are properly wired with canonical reward config, correct
 * location IDs, active status, and their real confirmed answer hashes.
 * Full 14-quest canonical roster audit verifies 1-to-1 mapping of 9
 * fragments and 3 Founder Locks.
 */

import { describe, expect, it } from 'vitest';
import {
  authorizeQuestEvidenceUpload,
  getCollectiblesForPlayer,
  getLocalCipherFragmentGrants,
  isPlayerQualifiedForFinale,
  setCurrentPlayer,
  submitQuestProof,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_LOCATIONS, SEED_QUESTS } from '../lib/seed-data';
import { FOUNDER_CIPHER_DISTRICTS } from '../lib/founders-cipher';
import { checkFinaleEligibility } from '../lib/finale';

const EVENT_ID = SEED_EVENT.id;

function newPlayer(label: string) {
  return setCurrentPlayer(`Phase3E_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, '🔍');
}

function questById(id: string) {
  const quest = SEED_QUESTS.find((q) => q.id === id);
  if (!quest) throw new Error(`Fixture setup error: missing seed quest ${id}`);
  return quest;
}

const TOWER = questById('qst-challenge-the-tower');
const GOLDEN_MARK = questById('qst-golden-mark');
const SPRING_WATER = questById('qst-spring-water-shelter');

describe('THE TOWER (Quest 7) — confirmed active (Founder Lock: THE CODE)', () => {
  it('is active — visible to player browsing', () => {
    expect(TOWER.status).toBe('active');
  });

  it('uses passphrase verification targeting structural tier/opening observation', () => {
    expect(TOWER.verificationType).toBe('passphrase');
  });

  it('has valid location coordinates wired to loc-challenge-tower at Mother Goose Land', () => {
    expect(TOWER.locationId).toBe('loc-challenge-tower');
    expect(TOWER.location).toBeDefined();
    expect(TOWER.location?.latitude).toBe(40.8056);
    expect(TOWER.location?.longitude).toBe(-81.3864);
  });

  it('is reward-wired to grant Founder Lock THE CODE upon verified resolution', () => {
    expect(TOWER.rewardConfig?.threeLocksFragment).toEqual({
      lock: 'code',
      collectibleId: 'col-founder-code',
    });
  });

  it('wrong passphrases are rejected; the real confirmed answer (1954) succeeds and grants THE CODE', () => {
    const player = newPlayer('tower-wrong');
    for (const guess of ['1', '2', '3', '4', '5', 'silo', 'tower', 'test', '']) {
      const result = submitQuestProof({
        playerId: player.id,
        questId: TOWER.id,
        eventId: EVENT_ID,
        proofType: 'passphrase',
        submittedContent: guess,
      });
      expect(result.success).toBe(false);
    }
    expect(getCollectiblesForPlayer(player.id)).toHaveLength(0);

    const correct = submitQuestProof({
      playerId: player.id,
      questId: TOWER.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1954',
    });
    expect(correct.success).toBe(true);
    expect(correct.threeLocksFragmentAwarded).toBe('code');
  });

  it('awards exactly 1 drawing entry reward upon completion', () => {
    expect(TOWER.drawingEntryReward).toBe(1);
    expect(TOWER.xpReward).toBe(100);
  });
});

describe('THE GOLDEN MARK (Quest 13) — confirmed active (Founder Lock: THE MARK)', () => {
  it('is active — visible to player browsing', () => {
    expect(GOLDEN_MARK.status).toBe('active');
  });

  it('uses passphrase verification targeting stone dedication plaque', () => {
    expect(GOLDEN_MARK.verificationType).toBe('passphrase');
  });

  it('has locationId loc-golden-mark wired to SEED_LOCATIONS[18]', () => {
    expect(GOLDEN_MARK.locationId).toBe('loc-golden-mark');
    expect(GOLDEN_MARK.location).toBe(SEED_LOCATIONS[18]);
  });

  it('is reward-wired to grant Founder Lock THE MARK upon verified resolution', () => {
    expect(GOLDEN_MARK.rewardConfig?.threeLocksFragment).toEqual({
      lock: 'mark',
      collectibleId: 'col-founder-mark',
    });
  });

  it('wrong passphrases are rejected; the real confirmed answer (1805, Canton\'s founding year) succeeds and grants THE MARK', () => {
    const player = newPlayer('golden-mark-wrong');
    for (const guess of ['test', 'canton', 'gold', 'mark', '1927', 'katherine', '']) {
      const result = submitQuestProof({
        playerId: player.id,
        questId: GOLDEN_MARK.id,
        eventId: EVENT_ID,
        proofType: 'passphrase',
        submittedContent: guess,
      });
      expect(result.success).toBe(false);
    }
    expect(getCollectiblesForPlayer(player.id)).toHaveLength(0);

    const correct = submitQuestProof({
      playerId: player.id,
      questId: GOLDEN_MARK.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: '1805',
    });
    expect(correct.success).toBe(true);
    expect(correct.threeLocksFragmentAwarded).toBe('mark');
  });

  it('the legacy qst-centennial-discovery quest does NOT grant THE MARK — permanently contained', () => {
    const legacy = SEED_QUESTS.find((q) => q.id === 'qst-centennial-discovery');
    expect(legacy?.rewardConfig).toBeUndefined();

    const markGranters = SEED_QUESTS.filter((q) => q.rewardConfig?.threeLocksFragment?.lock === 'mark');
    expect(markGranters.map((q) => q.id)).toEqual(['qst-golden-mark']);
  });

  it('awards exactly 1 drawing entry reward upon completion', () => {
    expect(GOLDEN_MARK.drawingEntryReward).toBe(1);
    expect(GOLDEN_MARK.xpReward).toBe(100);
  });
});

describe('SPRING WATER SHELTER (Quest 14) — confirmed active (Fragment: AT WEST LAWN)', () => {
  it('is active — visible to player browsing', () => {
    expect(SPRING_WATER.status).toBe('active');
  });

  it('uses passphrase verification targeting structural pavilion observation', () => {
    expect(SPRING_WATER.verificationType).toBe('passphrase');
  });

  it('has locationId loc-spring-water-shelter wired to SEED_LOCATIONS[19]', () => {
    expect(SPRING_WATER.locationId).toBe('loc-spring-water-shelter');
    expect(SPRING_WATER.location).toBe(SEED_LOCATIONS[19]);
  });

  it('is reward-wired to grant Secret fragment [AT WEST LAWN] upon verified resolution', () => {
    expect(SPRING_WATER.rewardConfig?.cipherFragmentKeys).toEqual(['secret-silent-court']);
  });

  it('wrong passphrases are rejected; the real confirmed answer (SPRING) succeeds and grants [AT WEST LAWN]', () => {
    const player = newPlayer('spring-water-wrong');
    for (const guess of ['test', 'four', 'two', 'three', 'fort hill', 'shelter', '']) {
      const result = submitQuestProof({
        playerId: player.id,
        questId: SPRING_WATER.id,
        eventId: EVENT_ID,
        proofType: 'passphrase',
        submittedContent: guess,
      });
      expect(result.success).toBe(false);
    }
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID)).toHaveLength(0);

    const correct = submitQuestProof({
      playerId: player.id,
      questId: SPRING_WATER.id,
      eventId: EVENT_ID,
      proofType: 'passphrase',
      submittedContent: 'spring',
    });
    expect(correct.success).toBe(true);
    expect(getLocalCipherFragmentGrants(player.id, EVENT_ID).some((f) => f.fragmentKey === 'secret-silent-court')).toBe(true);
  });

  it('awards exactly 1 drawing entry reward upon completion', () => {
    expect(SPRING_WATER.drawingEntryReward).toBe(1);
    expect(SPRING_WATER.xpReward).toBe(100);
  });
});

describe('CANONICAL ROSTER AUDIT — exactly 14 canonical field quests', () => {
  const CANONICAL_14: Record<string, string> = {
    'qst-bicentennial-bell-cipher': 'Bell Cipher',
    'qst-canton-sign-capture': 'Canton Sign Capture',
    'qst-nfl-draft-lineup': 'Draft Lineup',
    'qst-kraken-wall': 'Kraken Wall',
    'qst-palace-stars': 'Palace Stars',
    'qst-goose-land-cipher': 'The Mural',
    'qst-challenge-the-tower': 'The Tower',
    'qst-9th-street-opening': 'Skate Park Check-In',
    'qst-challenge-open-ground': 'The Open Ground',
    'qst-willie-the-whale': 'Willie the Whale',
    'qst-eternal-flame': 'The Eternal Flame',
    'qst-mckinley-cipher': 'Monument Park',
    'qst-golden-mark': 'The Golden Mark',
    'qst-spring-water-shelter': 'Spring Water Shelter',
  };

  it('all 14 canonical quest ids exist exactly once in SEED_QUESTS', () => {
    const ids = Object.keys(CANONICAL_14);
    expect(ids).toHaveLength(14);
    for (const id of ids) {
      const matches = SEED_QUESTS.filter((q) => q.id === id);
      expect(matches).toHaveLength(1);
    }
  });

  it('every canonical quest awards exactly 1 drawing entry', () => {
    for (const id of Object.keys(CANONICAL_14)) {
      const quest = SEED_QUESTS.find((q) => q.id === id)!;
      expect(quest.drawingEntryReward).toBe(1);
    }
  });

  it('no duplicate Mural — the retired qst-challenge-the-mural stays inactive, no reward', () => {
    const retired = SEED_QUESTS.find((q) => q.id === 'qst-challenge-the-mural');
    expect(retired?.status).toBe('inactive');
    expect(retired?.rewardConfig).toBeUndefined();
  });

  it('no old C1-C4 linear Storybook chain quest appears among the canonical 14 ids', () => {
    const c1c4Ids = [
      'qst-challenge-blue-signal',
      'qst-challenge-storybook-witness',
      'qst-challenge-what-survived',
      'qst-challenge-the-lost-page',
    ];
    for (const id of c1c4Ids) {
      expect(Object.keys(CANONICAL_14)).not.toContain(id);
    }
  });

  it('no legacy Three Locks convergence quest (qst-secret-cipher-77) appears among the canonical 14', () => {
    expect(Object.keys(CANONICAL_14)).not.toContain('qst-secret-cipher-77');
  });

  it('no ordinary Frankenstein quest (qst-frankenstein-west-lawn) appears among the canonical 14', () => {
    expect(Object.keys(CANONICAL_14)).not.toContain('qst-frankenstein-west-lawn');
  });

  it('no legacy Lock-granting quest (Centennial/Onesto/Watchers-Silent-Court) appears among the canonical 14, and none of them carry a rewardConfig', () => {
    const legacyIds = ['qst-centennial-discovery', 'qst-onesto-brass-motto', 'qst-watchers-silent-court'];
    for (const id of legacyIds) {
      expect(Object.keys(CANONICAL_14)).not.toContain(id);
      const quest = SEED_QUESTS.find((q) => q.id === id);
      expect(quest?.rewardConfig).toBeUndefined();
    }
  });

  it('none of the 14 canonical quests carry a prerequisiteQuestId', () => {
    for (const id of Object.keys(CANONICAL_14)) {
      const quest = SEED_QUESTS.find((q) => q.id === id)!;
      expect(quest.prerequisiteQuestId).toBeUndefined();
    }
  });
});

describe('CANONICAL REWARD AUDIT — each fragment/Lock has exactly one intended source anywhere in the seed roster', () => {
  it.each([
    ['arts-founder-signal', 'A NAME', 'qst-canton-sign-capture'],
    ['arts-painted-witness', 'OUTLIVES', 'qst-nfl-draft-lineup'],
    ['arts-palace-lantern', 'THE MAN', 'qst-kraken-wall'],
    ['challenge-brass-key', 'THE WORLD', 'qst-goose-land-cipher'],
    ['challenge-helmet-emblem', 'GAVE A MONSTER', 'qst-challenge-open-ground'],
    ['challenge-neon-loop', 'HIS NAME', 'qst-willie-the-whale'],
    ['secret-stone-stair', 'THE DEAD', 'qst-eternal-flame'],
    ['secret-quiet-signal', 'KEEP IT', 'qst-mckinley-cipher'],
    ['secret-silent-court', 'AT WEST LAWN', 'qst-spring-water-shelter'],
  ] as const)('fragment key %s (%s) is granted by exactly one quest anywhere in the seed roster: %s', (key, _phrase, expectedId) => {
    const granters = SEED_QUESTS.filter((q) => q.rewardConfig?.cipherFragmentKeys?.includes(key));
    expect(granters.map((q) => q.id)).toEqual([expectedId]);
  });

  it('every canonicalFragmentKey in FOUNDER_CIPHER_DISTRICTS has exactly one real quest source (or zero, if not yet implemented) — none has more than one', () => {
    for (const district of FOUNDER_CIPHER_DISTRICTS) {
      for (const key of district.canonicalFragmentKeys) {
        const granters = SEED_QUESTS.filter((q) => q.rewardConfig?.cipherFragmentKeys?.includes(key));
        expect(granters.length).toBe(1);
      }
    }
  });

  it.each([
    ['word', 'THE WORD', 'qst-bicentennial-bell-cipher'],
    ['code', 'THE CODE', 'qst-challenge-the-tower'],
    ['mark', 'THE MARK', 'qst-golden-mark'],
  ] as const)('Founder Lock %s (%s) is granted by exactly one quest: %s', (lock, _name, expectedId) => {
    const granters = SEED_QUESTS.filter((q) => q.rewardConfig?.threeLocksFragment?.lock === lock);
    expect(granters.map((q) => q.id)).toEqual([expectedId]);
  });
});

describe('FULL SYSTEM — Master Cipher gate unaffected by Phase 3E', () => {
  const config = {
    eventId: EVENT_ID,
    requiredSigilCount: 3,
    requiresWatcherEligibility: false,
    masterCipherCluePieces: [],
    finalAnswerHash: 'sha256:deadbeef',
    finalDestinationReveal: null,
    opensAt: null,
    closesAt: null,
    falseFinaleEnabled: false,
    falseFinaleAnswerHash: null,
    falseFinaleRevealText: null,
  };

  it('3 Locks alone do not unlock the Master Cipher', () => {
    expect(checkFinaleEligibility(config, 0, true, false, false).ok).toBe(false);
  });

  it('3 Sigils alone do not unlock the Master Cipher', () => {
    expect(checkFinaleEligibility(config, 3, false, false, false).ok).toBe(false);
  });

  it('3 Locks + 3 Sigils unlock the Master Cipher', () => {
    expect(checkFinaleEligibility(config, 3, true, false, false).ok).toBe(true);
  });

  it('Frankenstein remains outside the canonical 14 and cannot bypass the Master Cipher sequence via completion', () => {
    const quest = SEED_QUESTS.find((q) => q.id === 'qst-frankenstein-west-lawn')!;
    const player = newPlayer('frankenstein-3e');
    const { path: evidencePath } = authorizeQuestEvidenceUpload({ eventId: EVENT_ID, playerId: player.id, questId: quest.id });
    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: EVENT_ID,
      proofType: 'photo',
      proofUrl: evidencePath,
    });
    expect(result.submission.status).toBe('verified');
    expect(isPlayerQualifiedForFinale(player.id, EVENT_ID)).toBe(false);
  });
});
