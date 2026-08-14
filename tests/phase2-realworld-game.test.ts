import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDistanceMeters, checkProximity, formatDistance } from '../lib/geo';
import {
  calculateQuestState,
  getLeaderboardForEvent,
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

  describe('3. Individual Player Progression & Leaderboard Scoring', () => {
    it('creates individual player, tracks XP, and calculates individual rank on event leaderboard', () => {
      const player1 = setCurrentPlayer('SoloAgent_Alpha_Test', '🛡️');
      const player2 = setCurrentPlayer('SoloAgent_Beta_Test', '⚔️');

      expect(player1.id).toBeDefined();
      expect(player2.id).toBeDefined();

      const quest = SEED_QUESTS[0];
      const subRes = submitQuestProof({
        playerId: player1.id,
        questId: quest.id,
        eventId: SEED_EVENT.id,
        proofType: quest.verificationType,
        submittedContent: quest.verificationType === 'qr' ? 'CQ-AURA-FOUNDER' : 'checkin',
        userLat: quest.location?.latitude || 40.7989,
        userLon: quest.location?.longitude || -81.3748,
      });

      expect(subRes.success).toBe(true);
      expect(subRes.awardedPoints).toBeGreaterThan(0);

      const leaderboard = getLeaderboardForEvent(SEED_EVENT.id);
      expect(leaderboard.length).toBeGreaterThan(0);
      expect(leaderboard[0].rank).toBe(1);

      const p1Entry = leaderboard.find((e) => e.playerId === player1.id);
      expect(p1Entry).toBeDefined();
      expect(p1Entry?.totalPoints).toBeGreaterThanOrEqual(subRes.awardedPoints);
    });
  });

  describe('4. Combined QR + Location Proximity Verification', () => {
    it('enforces location radius on location-verified quests', () => {
      const player = setCurrentPlayer('Tester_Geo_Proximity', '📍');
      const quest = SEED_QUESTS.find((q) => q.requireQrAndLocation) || SEED_QUESTS[0];
      const submittedContent = quest.verificationType === 'qr' ? 'CQ-AURA-FOUNDER' : 'checkin';

      // Submit from far away (0,0)
      const farResult = submitQuestProof({
        playerId: player.id,
        questId: quest.id,
        eventId: SEED_EVENT.id,
        proofType: quest.verificationType,
        submittedContent,
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
        submittedContent,
        userLat: quest.location?.latitude || 40.7989,
        userLon: quest.location?.longitude || -81.3748,
      });

      expect(nearResult.success).toBe(true);
      expect(nearResult.awardedPoints).toBe(quest.xpReward || quest.pointValue);
    });
  });
});
