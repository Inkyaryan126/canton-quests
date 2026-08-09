// Canton Quests — Phase 3 Live Weekend Engine Verification Suite

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  getEvents,
  setEventPhase,
  toggleEventPause,
  createAnnouncement,
  getAnnouncements,
  createSecretCode,
  redeemSecretCode,
  awardCollectible,
  getCollectiblesForPlayer,
  updateNPCCharacter,
  getNPCCharacters,
  createBonusWindow,
  getActiveBonusMultiplier,
  adjustPlayerScoreManual,
  reconcilePlayerScores,
  grantFinaleQualification,
  isPlayerQualifiedForFinale,
  submitQuestProof,
  getLeaderboardForEvent,
  setCurrentPlayer,
  getQuestById,
} from '../lib/game-engine';

describe('Canton Quests — Phase 3 Live Weekend Engine', () => {
  beforeEach(() => {
    initializeGameEngine();
  });

  it('1. should support event phases and emergency pause controls', () => {
    const events = getEvents();
    const eventId = events[0].id;

    // Set phase
    const updatedPhase = setEventPhase(eventId, 'finale');
    expect(updatedPhase?.currentPhase).toBe('finale');

    // Emergency Pause
    const paused = toggleEventPause(eventId, true, 'Severe Thunderstorm Warning');
    expect(paused?.isPaused).toBe(true);
    expect(paused?.pauseReason).toBe('Severe Thunderstorm Warning');

    // Attempt submission while paused
    const player = setCurrentPlayer(`TestP1_${Date.now()}`);
    const subRes = submitQuestProof({
      playerId: player.id,
      questId: 'qst-centennial-discovery',
      eventId,
      proofType: 'checkin',
      userLat: 40.7989,
      userLon: -81.3748,
    });

    expect(subRes.success).toBe(false);
    expect(subRes.message).toContain('Event is currently paused');

    // Resume
    const resumed = toggleEventPause(eventId, false);
    expect(resumed?.isPaused).toBe(false);
  });

  it('2. should create and broadcast live announcements', () => {
    const events = getEvents();
    const eventId = events[0].id;

    const ann = createAnnouncement(
      eventId,
      'FLASH DROP IN MARKET SQUARE',
      'First 5 teams earn double XP!',
      'flash'
    );

    expect(ann.id).toBeDefined();
    expect(ann.urgency).toBe('flash');

    const activeAnns = getAnnouncements(eventId);
    expect(activeAnns.some((a) => a.id === ann.id)).toBe(true);
  });

  it('3. should enforce secret code redemption uniqueness and grant collectibles', () => {
    const events = getEvents();
    const eventId = events[0].id;
    const player = setCurrentPlayer(`CodeAgent_${Date.now()}`);

    // Redeem code FOUNDER2026
    const res1 = redeemSecretCode('FOUNDER2026', player.id, eventId);
    expect(res1.success).toBe(true);
    expect(res1.pointsAwarded).toBe(150);
    expect(res1.collectibleAwarded?.name).toBe('Founder Token');

    // Attempt second redemption (must fail)
    const res2 = redeemSecretCode('FOUNDER2026', player.id, eventId);
    expect(res2.success).toBe(false);
    expect(res2.message).toContain('already redeemed');

    // Verify collectible in vault
    const playerCols = getCollectiblesForPlayer(player.id);
    expect(playerCols.some((pc) => pc.collectible?.slug === 'founder-token')).toBe(true);
  });

  it('4. should enforce atomic claim limits on quests', () => {
    const events = getEvents();
    const eventId = events[0].id;
    const quest = getQuestById('qst-mckinley-cipher')!;

    // Set tight claim limit = 1 for testing
    quest.claimLimit = 1;
    quest.currentClaims = 0;

    const p1 = setCurrentPlayer(`SpeedAgent1_${Date.now()}`);
    const res1 = submitQuestProof({
      playerId: p1.id,
      questId: quest.id,
      eventId,
      proofType: 'passphrase',
      submittedContent: '1897',
    });
    expect(res1.success).toBe(true);

    // Second player tries to claim filled slot
    const p2 = setCurrentPlayer(`SlowAgent2_${Date.now()}`);
    const res2 = submitQuestProof({
      playerId: p2.id,
      questId: quest.id,
      eventId,
      proofType: 'passphrase',
      submittedContent: '1897',
    });
    expect(res2.success).toBe(false);
    expect(res2.message).toContain('Claim limit reached');

    // Reset claim limit
    quest.claimLimit = undefined;
    quest.currentClaims = 0;
  });

  it('5. should award placement bonuses for race-style quests', () => {
    const events = getEvents();
    const eventId = events[0].id;
    const quest = getQuestById('qst-palace-theatre-year')!;
    quest.raceRewards = [
      { place: 1, bonusPoints: 300 },
      { place: 2, bonusPoints: 150 },
    ];
    quest.currentClaims = 0; // Reset claim count

    const p1 = setCurrentPlayer(`Racer1_${Date.now()}`);
    const res1 = submitQuestProof({
      playerId: p1.id,
      questId: quest.id,
      eventId,
      proofType: 'passphrase',
      submittedContent: '1927',
    });

    expect(res1.success).toBe(true);
    expect(res1.claimPlacement).toBe(1);
    // 125 base + 300 1st place bonus = 425 XP
    expect(res1.awardedPoints).toBe(425);

    // Reset quest state
    quest.raceRewards = undefined;
    quest.currentClaims = 0;
  });

  it('6. should apply category bonus window multipliers to score ledger', () => {
    const events = getEvents();
    const eventId = events[0].id;
    const quest = getQuestById('qst-mckinley-cipher')!;
    quest.claimLimit = undefined;
    quest.currentClaims = 0;

    // Create 2.0x Double XP bonus for puzzle category
    createBonusWindow(eventId, 'Double XP Sprint', 2.0, 'puzzle', 30);
    const mult = getActiveBonusMultiplier(eventId, 'puzzle');
    expect(mult).toBe(2.0);

    const player = setCurrentPlayer(`BonusHunter_${Date.now()}`);
    const res = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId,
      proofType: 'passphrase',
      submittedContent: '1897',
    });

    expect(res.success).toBe(true);
    // 150 base * 2.0 = 300 XP
    expect(res.awardedPoints).toBe(300);
  });

  it('7. should audit manual score adjustments and perform reconciliation', () => {
    const events = getEvents();
    const eventId = events[0].id;
    const player = setCurrentPlayer(`AuditAgent_${Date.now()}`);

    const entry = adjustPlayerScoreManual(
      eventId,
      player.id,
      250,
      'Field Excellence Award',
      'Game Director Alpha'
    );

    expect(entry.points).toBe(250);
    expect(entry.adminIdentity).toBe('Game Director Alpha');

    const recon = reconcilePlayerScores(eventId);
    expect(recon.reconciledCount).toBeGreaterThanOrEqual(0);

    const lb = getLeaderboardForEvent(eventId);
    const pEntry = lb.find((l) => l.playerId === player.id);
    expect(pEntry?.totalPoints).toBeGreaterThanOrEqual(250);
  });

  it('8. should manage finale qualifications and wildcards', () => {
    const events = getEvents();
    const eventId = events[0].id;
    const player = setCurrentPlayer(`WildcardAgent_${Date.now()}`);

    expect(isPlayerQualifiedForFinale(player.id, eventId)).toBe(false);

    grantFinaleQualification(eventId, player.id, 'Game Master Wildcard', true);
    expect(isPlayerQualifiedForFinale(player.id, eventId)).toBe(true);
  });
});
