// Canton Quests — Phase 5.6 Individual Player Competition Invariants Suite

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetGameEngineStore,
  setCurrentPlayer,
  getAllPlayers,
  submitQuestProof,
  getLeaderboardForEvent,
  getPlayerProgress,
  recordScoreLedger,
  awardDrawingEntries,
  getDrawingEntriesForPlayer,
  getPublicDrawingPageData,
  computeEventReadinessReport,
  runWalkUpPlayerRehearsal,
  runFullEventRehearsal,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';

describe('Phase 5.6 — Pure Individual Player Competition Architecture', () => {
  beforeEach(() => {
    resetGameEngineStore();
  });

  it('1. establishes individual player identity without requiring any team membership', () => {
    const player = setCurrentPlayer('SoloAgent_Echo', '⚡');
    expect(player.id).toBeDefined();
    expect(player.displayName).toBe('SoloAgent_Echo');
    expect(player.totalXp).toBe(0);

    const allPlayers = getAllPlayers();
    expect(allPlayers.some((p) => p.id === player.id)).toBe(true);
  });

  it('2. awards quest completion XP directly and exclusively to individual player ledger', () => {
    const player = setCurrentPlayer(`SoloAgent_${Date.now()}`, '🎯');
    const quest = SEED_QUESTS[0];

    const result = submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: quest.verificationType,
      submittedContent: quest.verificationType === 'qr' ? 'CQ-AURA-FOUNDER' : 'checkin',
      userLat: quest.location?.latitude || 40.7989,
      userLon: quest.location?.longitude || -81.3748,
    });

    expect(result.success).toBe(true);
    expect(result.awardedPoints).toBeGreaterThan(0);
    expect(result.submission.playerId).toBe(player.id);
  });

  it('3. generates pure individual leaderboard with accurate rankings and tie-breaking', () => {
    const p1 = setCurrentPlayer('Agent_First', '🥇');
    const p2 = setCurrentPlayer('Agent_Second', '🥈');

    recordScoreLedger({
      eventId: SEED_EVENT.id,
      playerId: p1.id,
      points: 500,
      category: 'exploration',
      description: 'First Place Lead',
    });

    recordScoreLedger({
      eventId: SEED_EVENT.id,
      playerId: p2.id,
      points: 300,
      category: 'puzzle',
      description: 'Second Place Chase',
    });

    const leaderboard = getLeaderboardForEvent(SEED_EVENT.id);
    expect(leaderboard.length).toBeGreaterThanOrEqual(2);

    const p1Entry = leaderboard.find((e) => e.playerId === p1.id);
    const p2Entry = leaderboard.find((e) => e.playerId === p2.id);

    expect(p1Entry).toBeDefined();
    expect(p2Entry).toBeDefined();
    expect(p1Entry!.rank).toBeLessThan(p2Entry!.rank);
    expect(p1Entry!.totalPoints).toBe(500);
    expect(p1Entry!.displayName).toBe('Agent_First');
    expect(p2Entry!.totalPoints).toBe(300);
    expect(p2Entry!.displayName).toBe('Agent_Second');
  });

  it('4. tracks individual player progress without team dependencies', () => {
    const player = setCurrentPlayer('Agent_ProgressTest', '🧭');
    const quest = SEED_QUESTS[0];

    submitQuestProof({
      playerId: player.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: quest.verificationType,
      submittedContent: quest.verificationType === 'qr' ? 'CQ-AURA-FOUNDER' : 'checkin',
      userLat: quest.location?.latitude || 40.7989,
      userLon: quest.location?.longitude || -81.3748,
    });

    const progress = getPlayerProgress(player.id, SEED_EVENT.id);
    expect(progress.completedCount).toBeGreaterThanOrEqual(1);
    expect(progress.totalPoints).toBeGreaterThan(0);
    expect(progress.rank).toBeGreaterThan(0);
    expect((progress as any).team).toBeUndefined();
  });

  it('5. issues prize drawing entries to individual players in drawing ledger', () => {
    const player = setCurrentPlayer('Agent_LuckyDraw', '🎟️');

    const entry = awardDrawingEntries({
      eventId: SEED_EVENT.id,
      playerId: player.id,
      entriesCount: 5,
      sourceType: 'quest_completion',
      reason: 'Completed high-tier mission',
    });

    expect(entry).toBeDefined();
    expect(entry.entriesCount).toBe(5);
    expect(entry.playerId).toBe(player.id);

    const playerEntries = getDrawingEntriesForPlayer(player.id, SEED_EVENT.id);
    expect(playerEntries.length).toBeGreaterThanOrEqual(1);
    expect(playerEntries[0].entriesCount).toBe(5);

    const pageData = getPublicDrawingPageData(SEED_EVENT.id);
    expect(pageData.totalQualifiedEntries).toBeGreaterThanOrEqual(5);
    expect(pageData.totalQualifiedPlayers).toBeGreaterThanOrEqual(1);
  });

  it('6. executes launch readiness and simulated rehearsals under individual player model', async () => {
    const report = await computeEventReadinessReport(SEED_EVENT.id);
    expect(report).toBeDefined();
    expect(report.metrics.totalQuests).toBeGreaterThan(0);

    const walkUp = await runWalkUpPlayerRehearsal(SEED_EVENT.id);
    expect(walkUp.isSuccess).toBe(true);
    expect(walkUp.simulatedPlayer.id).toBeDefined();
    expect(walkUp.simulatedPlayer.earnedXp).toBeGreaterThan(0);

    const fullRehearsal = await runFullEventRehearsal(SEED_EVENT.id);
    expect(fullRehearsal.isSuccess).toBe(true);
    expect(fullRehearsal.simulatedPlayerCount).toBeGreaterThan(0);
    expect(fullRehearsal.productionDataVerifiedUntouched).toBe(true);
  });
});
