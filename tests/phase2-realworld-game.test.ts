import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDistanceMeters, checkProximity, formatDistance } from '../lib/geo';
import {
  calculateQuestState,
  createTeam,
  joinTeamByCode,
  getTeamForPlayer,
  getTeamLeaderboardForEvent,
  submitQuestProof,
  initializeGameEngine,
  setCurrentPlayer,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { Quest } from '../lib/types';

describe('Phase 2 — Real-World Game Layer Engine', () => {
  beforeEach(() => {
    initializeGameEngine();
  });

  describe('1. Geolocation & Haversine Distance Logic', () => {
    it('accurately calculates distance between Centennial Plaza and McKinley Monument in Canton', () => {
      // Centennial Plaza: 40.7989, -81.3748
      // McKinley Monument: 40.8064, -81.3933
      const distance = calculateDistanceMeters(40.7989, -81.3748, 40.8064, -81.3933);
      // Expected distance is ~1780m (1.78km)
      expect(distance).toBeGreaterThan(1500);
      expect(distance).toBeLessThan(2000);
      expect(formatDistance(distance)).toContain('km');
    });

    it('verifies proximity when player is within radius and fails when outside', () => {
      const plazaLat = 40.7989;
      const plazaLon = -81.3748;

      // Nearby point (~10m away)
      const nearbyRes = checkProximity({ latitude: 40.79895, longitude: -81.37485 }, plazaLat, plazaLon, 50);
      expect(nearbyRes.isWithinRadius).toBe(true);

      // Far point (~500m away)
      const farRes = checkProximity({ latitude: 40.803, longitude: -81.375 }, plazaLat, plazaLon, 50);
      expect(farRes.isWithinRadius).toBe(false);
      expect(farRes.message).toContain('Too far');
    });
  });

  describe('2. Quest State Calculation & Unlock Chains', () => {
    it('calculates available state for standard unlocked quest', () => {
      const state = calculateQuestState(SEED_QUESTS[0], [], []);
      expect(state).toBe('available');
    });

    it('locks prerequisite quest when prerequisite is incomplete', () => {
      // Find quest with prerequisite
      const chainStep2 = SEED_QUESTS.find((q) => q.prerequisiteQuestId)!;
      expect(chainStep2).toBeDefined();

      const prereqId = chainStep2.prerequisiteQuestId!;

      const stateWithoutPrereq = calculateQuestState(chainStep2, [], []);
      expect(stateWithoutPrereq).toBe('locked');

      // Once prerequisite quest is completed
      const stateWithPrereq = calculateQuestState(chainStep2, [prereqId], []);
      expect(stateWithPrereq).toBe('available');
    });

    it('identifies flash quests and handles expiration', () => {
      const now = Date.now();
      const flashQuest: Quest = {
        ...SEED_QUESTS[0],
        isFlash: true,
        startsAt: new Date(now - 10000).toISOString(),
        expiresAt: new Date(now + 60000).toISOString(),
      };

      const activeState = calculateQuestState(flashQuest, [], [], now);
      expect(activeState).toBe('flash');

      const expiredState = calculateQuestState(flashQuest, [], [], now + 120000);
      expect(expiredState).toBe('expired');
    });
  });

  describe('3. Team Operations & Scoring', () => {
    it('creates team, generates join code, and allows joining by code', () => {
      const player1 = setCurrentPlayer('Captain_Alpha_Test', '🛡️');
      const player2 = setCurrentPlayer('Rover_Beta_Test', '⚔️');

      const newTeam = createTeam(SEED_EVENT.id, 'Test Vanguard Squad', player1.id, '🛡️');
      expect(newTeam.name).toBe('Test Vanguard Squad');
      expect(newTeam.joinCode).toMatch(/^CQ-[A-Z0-9]{4}$/);

      const joinRes = joinTeamByCode(newTeam.joinCode, player2.id, SEED_EVENT.id);
      expect(joinRes.success).toBe(true);
      expect(joinRes.team?.id).toBe(newTeam.id);

      const teamInfo = getTeamForPlayer(player2.id, SEED_EVENT.id);
      expect(teamInfo.team?.id).toBe(newTeam.id);
      expect(teamInfo.members.length).toBe(2);
    });

    it('calculates team leaderboard score from team member quest completions', () => {
      const teamLeaderboard = getTeamLeaderboardForEvent(SEED_EVENT.id);
      expect(teamLeaderboard.length).toBeGreaterThan(0);
      expect(teamLeaderboard[0].rank).toBe(1);
      expect(teamLeaderboard[0].totalPoints).toBeGreaterThanOrEqual(0);
    });
  });

  describe('4. Combined QR + Location Proximity Verification', () => {
    it('enforces location radius on location-verified quests', () => {
      const player = setCurrentPlayer('Tester_Geo_Proximity', '📍');
      const quest = SEED_QUESTS.find((q) => q.requireLocationVerification) || SEED_QUESTS[0];

      // Submit from far away (0,0)
      const farResult = submitQuestProof({
        playerId: player.id,
        questId: quest.id,
        eventId: SEED_EVENT.id,
        proofType: quest.verificationType,
        submittedContent: quest.targetCode || 'checkin',
        userLat: 0,
        userLon: 0,
      });

      expect(farResult.success).toBe(false);
      expect(farResult.message).toContain('Too far');

      // Submit from exact location
      const nearResult = submitQuestProof({
        playerId: player.id,
        questId: quest.id,
        eventId: SEED_EVENT.id,
        proofType: quest.verificationType,
        submittedContent: quest.targetCode || 'checkin',
        userLat: quest.location?.latitude || 40.7989,
        userLon: quest.location?.longitude || -81.3748,
      });

      expect(nearResult.success).toBe(true);
      expect(nearResult.awardedPoints).toBe(quest.pointValue);
    });
  });
});
