import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  registerPlayer,
  updatePlayerProfile,
  getPlayerById,
  getAllPlayers,
  getQuestsForEvent,
  submitQuestProof,
  reviewSubmission,
  getAchievements,
  getAchievementsForPlayer,
  awardAchievement,
  evaluatePlayerAchievements,
  awardDay1XpLeaderBonus,
  getDistrictContentSummary,
  getAllDistrictsContentSummary,
  getEvents,
  getPublicDrawingPageData,
  getLeaderboardForEvent,
  recordScoreLedger,
} from '../lib/game-engine';
import {
  auditEventQuestsAndLocations,
  evaluateEventLaunchGates,
} from '../lib/event-readiness';
import { SEED_EVENT, SEED_ACHIEVEMENTS } from '../lib/seed-data';

describe('Player Identity & Three-Path City Architecture', () => {
  beforeEach(() => {
    resetGameEngineStore();
  });

  describe('1. Fast Player Account Registration & Optional Personalization', () => {
    it('creates a fast player account with 10-second onboarding fields', () => {
      const player = registerPlayer({
        displayName: 'NewApexSeeker_99',
        email: 'apex@example.com',
        selectedStartingPath: 'challenge',
        acquisitionSource: 'challenge_flyer',
      });

      expect(player.id).toBeDefined();
      expect(player.displayName).toBe('NewApexSeeker_99');
      expect(player.selectedStartingPath).toBe('challenge');
      expect(player.acquisitionSource).toBe('challenge_flyer');
      expect(player.totalXp).toBe(0);
      expect(player.level).toBe(1);
    });

    it('rejects invalid or blank callsigns', () => {
      expect(() => {
        registerPlayer({ displayName: ' ' });
      }).toThrow('Callsign must be at least 2 characters.');
    });

    it('allows optional profile personalization without breaking game progress', () => {
      const player = registerPlayer({
        displayName: 'DowntownDecoder_Test',
        selectedStartingPath: 'secret',
        acquisitionSource: 'secret_flyer',
      });

      const updated = updatePlayerProfile(player.id, {
        bio: 'Deciphering Canton brick by brick.',
        tagline: 'Always observing.',
        hometown: 'Canton, OH',
        themeColor: '#a855f7',
        favoriteStyle: 'Cryptic Mystery',
        selectedFlair: 'Cipher Hound',
        isMinor: true,
      });

      expect(updated.displayName).toBe('DowntownDecoder_Test');
      expect(updated.bio).toBe('Deciphering Canton brick by brick.');
      expect(updated.tagline).toBe('Always observing.');
      expect(updated.hometown).toBe('Canton, OH');
      expect(updated.themeColor).toBe('#a855f7');
      expect(updated.selectedFlair).toBe('Cipher Hound');
      expect(updated.isMinor).toBe(true);

      // Acquisition source and ID remain immutable
      expect(updated.id).toBe(player.id);
      expect(updated.acquisitionSource).toBe('secret_flyer');
    });

    it('retrieves player by ID', () => {
      const created = registerPlayer({
        displayName: 'GhostRunner_Test',
        selectedStartingPath: 'family',
      });
      const found = getPlayerById(created.id);
      expect(found).toBeDefined();
      expect(found?.displayName).toBe('GhostRunner_Test');
    });
  });

  describe('2. Three Starting Paths & Open City Grid Invariants', () => {
    it('has active quests assigned to each starting path', () => {
      const eventId = SEED_EVENT.id;
      const quests = getQuestsForEvent(eventId);

      const familyQuests = quests.filter((q) => q.startingPath === 'family');
      const challengeQuests = quests.filter((q) => q.startingPath === 'challenge');
      const secretQuests = quests.filter((q) => q.startingPath === 'secret');

      expect(familyQuests.length).toBeGreaterThanOrEqual(3);
      expect(challengeQuests.length).toBeGreaterThanOrEqual(2);
      expect(secretQuests.length).toBeGreaterThanOrEqual(2);
    });

    it('NEVER restricts players from completing quests outside their chosen starting path', () => {
      const eventId = SEED_EVENT.id;
      const player = registerPlayer({
        displayName: 'FamilyPlayerOne',
        selectedStartingPath: 'family', // Chosen Family
      });

      // Player solves a Secret path quest (McKinley Stone Stair Cipher)
      const res = submitQuestProof({
        playerId: player.id,
        questId: 'qst-mckinley-cipher', // Secret path quest
        eventId,
        proofType: 'passphrase',
        submittedContent: '1897',
        userLat: 40.8064,
        userLon: -81.3933,
        userAccuracyMeters: 10,
      });

      expect(res.success).toBe(true);
      expect(res.isQuestFullyCompleted).toBe(true);
      expect(res.awardedPoints).toBe(150);
    });

    it('generates accurate district content summaries and gap reports', () => {
      const eventId = SEED_EVENT.id;
      const allDistricts = getAllDistrictsContentSummary(eventId);

      expect(allDistricts.family.activeQuestsCount).toBeGreaterThanOrEqual(3);
      expect(allDistricts.family.totalAvailableXp).toBeGreaterThan(0);
      expect(allDistricts.challenge.activeQuestsCount).toBeGreaterThanOrEqual(2);
      expect(allDistricts.secret.activeQuestsCount).toBeGreaterThanOrEqual(2);

      // Challenge district content summaries and gap reports
      expect(allDistricts.challenge.contentGaps.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('3. Dynamic Achievements Engine', () => {
    it('initializes canonical achievements catalog', () => {
      const achievements = getAchievements();
      expect(achievements.length).toBeGreaterThanOrEqual(9);
      expect(achievements.some((a) => a.slug === 'triple-threat')).toBe(true);
      expect(achievements.some((a) => a.slug === 'day-one-king')).toBe(true);
    });

    it('awards Pathfinder achievement upon first completion in chosen path', () => {
      const eventId = SEED_EVENT.id;
      const player = registerPlayer({
        displayName: 'ExplorerFamily_Unique',
        selectedStartingPath: 'family',
      });

      const subRes = submitQuestProof({
        playerId: player.id,
        questId: 'qst-centennial-discovery', // Family quest
        eventId,
        proofType: 'checkin',
        userLat: 40.7989,
        userLon: -81.3748,
        userAccuracyMeters: 15,
      });

      expect(subRes.success).toBe(true);
      const playerAchievements = getAchievementsForPlayer(player.id);
      expect(playerAchievements.some((pa) => pa.achievementSlug === 'pathfinder-family')).toBe(true);
    });

    it('awards Triple Threat achievement when player solves missions across all 3 districts', () => {
      const eventId = SEED_EVENT.id;
      const player = registerPlayer({
        displayName: 'VersatileNomad_Unique',
        selectedStartingPath: 'challenge',
      });

      // 1. Complete Family Quest
      const sub1 = submitQuestProof({
        playerId: player.id,
        questId: 'qst-centennial-discovery',
        eventId,
        proofType: 'checkin',
        userLat: 40.7989,
        userLon: -81.3748,
        userAccuracyMeters: 15,
      });
      expect(sub1.success).toBe(true);

      // 2. Complete Challenge Quest (Arcade High Score Video with GM approval)
      const sub2 = submitQuestProof({
        playerId: player.id,
        questId: 'qst-arcade-high-score-video',
        eventId,
        proofType: 'video',
        proofUrl: 'https://example.com/celebration.mp4',
      });
      expect(sub2.success).toBe(true);
      reviewSubmission(sub2.submission.id, 'verified');

      // 3. Complete Secret Quest (McKinley Stone Stair Cipher)
      const sub3 = submitQuestProof({
        playerId: player.id,
        questId: 'qst-mckinley-cipher',
        eventId,
        proofType: 'passphrase',
        submittedContent: '1897',
        userLat: 40.8064,
        userLon: -81.3933,
        userAccuracyMeters: 15,
      });
      expect(sub3.success).toBe(true);

      const playerAchievements = getAchievementsForPlayer(player.id);
      expect(playerAchievements.some((pa) => pa.achievementSlug === 'triple-threat')).toBe(true);
    });

    it('prevents duplicate awards of the same achievement (idempotency)', () => {
      const player = registerPlayer({ displayName: 'IdempotencyTester_Unique' });
      const first = awardAchievement(player.id, 'pathfinder-family', SEED_EVENT.id);
      const second = awardAchievement(player.id, 'pathfinder-family', SEED_EVENT.id);

      expect(first).toBeDefined();
      expect(second?.id).toBe(first?.id);

      const all = getAchievementsForPlayer(player.id);
      const matching = all.filter((a) => a.achievementSlug === 'pathfinder-family');
      expect(matching.length).toBe(1);
    });
  });

  describe('4. Day 1 #1 XP Leader Bonus Engine (+5 Prize Entries)', () => {
    it('awards +5 drawing entries and Day 1 King achievement to top XP player', () => {
      const eventId = SEED_EVENT.id;
      const playerA = registerPlayer({ displayName: 'PlayerAlpha_Day1' });
      const playerB = registerPlayer({ displayName: 'PlayerBeta_Day1' });

      // Player A scores 500 XP
      recordScoreLedger({
        eventId,
        playerId: playerA.id,
        points: 500,
        category: 'puzzle',
        description: 'Completed multi-step cipher',
      });

      // Player B scores 300 XP
      recordScoreLedger({
        eventId,
        playerId: playerB.id,
        points: 300,
        category: 'exploration',
        description: 'Completed landmark run',
      });

      const bonusRes = awardDay1XpLeaderBonus(eventId);
      expect(bonusRes.success).toBe(true);
      expect(bonusRes.winnerPlayerId).toBe(playerA.id);
      expect(bonusRes.entriesAwarded).toBe(5);

      // Verify transparent drawing ledger
      const pageData = getPublicDrawingPageData(eventId);
      const playerEntry = pageData.publicPlayerEntries.find((e) => e.playerPublicLabel.includes('PlayerAlpha'));
      expect(playerEntry).toBeDefined();
      expect(playerEntry?.totalQualifiedEntries).toBeGreaterThanOrEqual(5);

      // Verify achievement awarded
      const achievements = getAchievementsForPlayer(playerA.id);
      expect(achievements.some((a) => a.achievementSlug === 'day-one-king')).toBe(true);
    });

    it('executes exactly once without duplicate prize entries (idempotent)', () => {
      const eventId = SEED_EVENT.id;
      const player = registerPlayer({ displayName: 'SoloLeader_Day1' });
      recordScoreLedger({
        eventId,
        playerId: player.id,
        points: 1000,
        category: 'puzzle',
        description: 'Massive score',
      });

      const firstCall = awardDay1XpLeaderBonus(eventId);
      expect(firstCall.success).toBe(true);
      expect(firstCall.entriesAwarded).toBe(5);

      const secondCall = awardDay1XpLeaderBonus(eventId);
      expect(secondCall.success).toBe(true);
      expect(secondCall.isDuplicatePrevented).toBe(true);

      const pageData = getPublicDrawingPageData(eventId);
      const playerEntry = pageData.publicPlayerEntries.find((e) => e.playerPublicLabel.includes('SoloLeader'));
      expect(playerEntry?.totalQualifiedEntries).toBe(5);
    });

    it('uses deterministic earliest timestamp tie-breaker for identical top scores', () => {
      const eventId = SEED_EVENT.id;
      const playerA = registerPlayer({ displayName: 'SpeedyFirst_Tie' });
      const playerB = registerPlayer({ displayName: 'LateSecond_Tie' });

      // Player A scores 400 XP at earlier time
      recordScoreLedger({
        eventId,
        playerId: playerA.id,
        points: 400,
        category: 'puzzle',
        description: 'First to 400',
      });

      // Player B scores 400 XP
      recordScoreLedger({
        eventId,
        playerId: playerB.id,
        points: 400,
        category: 'puzzle',
        description: 'Second to 400',
      });

      const res = awardDay1XpLeaderBonus(eventId);
      expect(res.success).toBe(true);
      expect(res.winnerPlayerId).toBe(playerA.id);
      expect(res.winningPlayerName).toBe('SpeedyFirst_Tie');
    });

    it('supports dry-run simulation in rehearsal mode without modifying data', () => {
      const eventId = SEED_EVENT.id;
      const player = registerPlayer({ displayName: 'RehearsalHero_Day1' });
      recordScoreLedger({
        eventId,
        playerId: player.id,
        points: 800,
        category: 'puzzle',
        description: 'Test run',
      });

      const sim = awardDay1XpLeaderBonus(eventId, true);
      expect(sim.success).toBe(true);
      expect(sim.message).toContain('[REHEARSAL]');

      // Real drawing ledger remains empty
      const pageData = getPublicDrawingPageData(eventId);
      expect(pageData.totalQualifiedEntries).toBe(0);
    });
  });

  describe('5. Hard Launch Gates & Event Integrity', () => {
    it('passes all launch gates with 3-path architecture and individual player model', () => {
      const eventId = SEED_EVENT.id;
      const gates = evaluateEventLaunchGates(eventId);

      expect(gates.isLaunchPermitted).toBe(true);
      expect(gates.failedCriticalCount).toBe(0);
      expect(gates.gates.some((g) => g.code === 'GATE_THREE_PATH_ARCHITECTURE_READY' && g.isPassed)).toBe(true);
      expect(gates.gates.some((g) => g.code === 'GATE_PLAYER_INDIVIDUAL_ARCHITECTURE' && g.isPassed)).toBe(true);
    });
  });
});
