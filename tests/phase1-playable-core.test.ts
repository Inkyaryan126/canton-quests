import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEvents,
  getEventBySlug,
  getQuestsForEvent,
  setCurrentPlayer,
  submitQuestProof,
  getLeaderboardForEvent,
  getPlayerProgress,
  reviewSubmission,
  initializeGameEngine,
  getQuestById,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';

describe('Canton Quests Phase 1 — Playable Core Engine', () => {
  beforeEach(() => {
    // Reset or ensure game engine state
    initializeGameEngine();
  });

  it('1. DISCOVER EVENT: retrieves Canton Quests Volume 1 event', () => {
    const events = getEvents();
    expect(events.length).toBeGreaterThan(0);

    const event = getEventBySlug('canton-weekend-1');
    expect(event).toBeDefined();
    expect(event?.title).toContain('Canton Quests: Volume 1');
    expect(event?.status).toBe('active');
  });

  it('2. JOIN / IDENTIFY PLAYER: sets up persistent player agent', () => {
    const player = setCurrentPlayer('TestAgent_330', '⚡');
    expect(player.displayName).toBe('TestAgent_330');
    expect(player.totalXp).toBeDefined();
    expect(player.level).toBeGreaterThanOrEqual(1);
  });

  it('3. VIEW QUESTS: loads seeded quests for Canton event', () => {
    const quests = getQuestsForEvent(SEED_EVENT.id);
    expect(quests.length).toBeGreaterThanOrEqual(12);

    const checkinQuest = quests.find((q) => q.verificationType === 'checkin');
    const passphraseQuest = quests.find((q) => q.verificationType === 'passphrase');
    const qrQuest = quests.find((q) => q.verificationType === 'qr');
    const photoQuest = quests.find((q) => q.verificationType === 'photo');

    expect(checkinQuest).toBeDefined();
    expect(passphraseQuest).toBeDefined();
    expect(qrQuest).toBeDefined();
    expect(photoQuest).toBeDefined();
  });

  it('4. COMPLETE QUEST & SUBMIT PROOF: verifies check-in and awards points', () => {
    const player = setCurrentPlayer('Agent_Checkin_Tester', '🎯');
    const quest = getQuestById('qst-centennial-discovery')!;

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      submittedContent: 'GPS Checkin Confirmed',
      userLat: 40.7989,
      userLon: -81.3748,
    });

    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBe(quest.xpReward || quest.pointValue);
    expect(result.submission.status).toBe('verified');
  });

  it('5. PASSPHRASE VERIFICATION: validates correct vs incorrect cipher code', () => {
    const player = setCurrentPlayer('Agent_Cipher_Tester', '🧩');
    const quest = SEED_QUESTS[1]; // McKinley Monument Year (targetCode: 1897, 150 XP)

    // Incorrect code attempt
    const failResult = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1901',
    });
    expect(failResult.success).toBe(false);
    expect(failResult.awardedPoints).toBe(0);

    // Correct code attempt
    const successResult = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1897',
      userLat: quest.location?.latitude,
      userLon: quest.location?.longitude,
    });
    expect(successResult.success).toBe(true);
    expect(successResult.awardedPoints).toBe(150);
  });

  it('6. PREVENT DUPLICATE POINT FARMING: rejects repeat completion attempts', () => {
    const player = setCurrentPlayer('Agent_Farming_Guard', '🛡️');
    const quest = SEED_QUESTS[5]; // Palace Theatre (125 XP)

    // First completion
    const firstAttempt = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1927',
    });
    expect(firstAttempt.success).toBe(true);
    expect(firstAttempt.awardedPoints).toBe(125);

    // Duplicate attempt
    const secondAttempt = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1927',
    });
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.awardedPoints).toBe(0);
    expect(secondAttempt.message).toContain('already completed');
  });

  it('7. SEE LEADERBOARD & PROGRESS: leaderboard reflects updated scores and rank', () => {
    const player = setCurrentPlayer('Agent_Leaderboard_Runner', '🏆');
    const quest = getQuestById('qst-grand-finale-cipher')!;

    submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: 'CQ-FINAL-KEY',
    });

    const leaderboard = getLeaderboardForEvent(SEED_EVENT.id);
    expect(leaderboard.length).toBeGreaterThan(0);

    const playerEntry = leaderboard.find((entry) => entry.playerId === player.id);
    expect(playerEntry).toBeDefined();
    expect(playerEntry?.totalPoints).toBeGreaterThanOrEqual(quest.xpReward || quest.pointValue);

    const progress = getPlayerProgress(player.id, SEED_EVENT.id);
    expect(progress.totalPoints).toBeGreaterThanOrEqual(quest.xpReward || quest.pointValue);
    expect(progress.completedCount).toBeGreaterThanOrEqual(1);
  });

  it('8. GAME MASTER ADMIN REVIEW: reviews pending photo proof and awards points', () => {
    const player = setCurrentPlayer('Agent_Media_Submitter', '📸');
    const quest = getQuestById('qst-4th-st-mural-photo')!;

    // Submits photo proof (routed to pending queue)
    const submitRes = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'photo',
      proofUrl: 'https://example.com/mural-photo.jpg',
    });

    expect(submitRes.success).toBe(true);
    expect(submitRes.submission.status).toBe('pending');
    expect(submitRes.awardedPoints).toBe(0);

    // Admin reviews and approves submission
    const reviewedSub = reviewSubmission(submitRes.submission.id, 'verified', 'Great pose!');
    expect(reviewedSub).toBeDefined();
    expect(reviewedSub?.status).toBe('verified');
    expect(reviewedSub?.awardedPoints).toBe(quest.xpReward || quest.pointValue);

    const progress = getPlayerProgress(player.id, SEED_EVENT.id);
    expect(progress.totalPoints).toBeGreaterThanOrEqual(quest.xpReward || quest.pointValue);
  });
});
