import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEventsDB,
  getEventBySlugDB,
  getQuestsForEventDB,
  upsertPlayerDB,
  submitQuestProofDB,
  getLeaderboardDB,
  getPlayerProgressDB,
  seedDatabaseDB,
} from '../lib/supabase-db';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';

describe('Canton Quests Phase 1.5 — Backend & Shared Multiplayer State', () => {
  beforeEach(async () => {
    await seedDatabaseDB();
  });

  it('1. MULTI-PLAYER SETUP: Creates separate persistent player agents A and B', async () => {
    const playerA = await upsertPlayerDB('Agent_Alpha_126', '⚡');
    const playerB = await upsertPlayerDB('Agent_Beta_330', '🧭');

    expect(playerA.displayName).toBe('Agent_Alpha_126');
    expect(playerB.displayName).toBe('Agent_Beta_330');
    expect(playerA.id).not.toBe(playerB.id);
  });

  it('2. SHARED SCORING & LEADERBOARD: Player A completes quest, Player B sees updated leaderboard', async () => {
    const playerA = await upsertPlayerDB('Agent_Alpha_126', '⚡');
    const playerB = await upsertPlayerDB('Agent_Beta_330', '🧭');

    const quest1 = SEED_QUESTS.find((quest) => quest.id === 'qst-centennial-discovery')!;

    // Player A completes quest 1
    const submitA = await submitQuestProofDB({
      playerId: playerA.id,
      questId: quest1.id,
      eventId: SEED_EVENT.id,
      proofType: 'checkin',
      submittedContent: 'GPS Checkin Confirmed',
      userLat: 40.7989,
      userLon: -81.3748,
    });

    expect(submitA.success).toBe(true);
    expect(submitA.awardedPoints).toBe(quest1.xpReward || quest1.pointValue);

    // Player B checks the shared event leaderboard
    const leaderboardForB = await getLeaderboardDB(SEED_EVENT.id);
    expect(leaderboardForB.length).toBeGreaterThan(0);

    const entryA = leaderboardForB.find((e) => e.playerId === playerA.id);
    expect(entryA).toBeDefined();
    expect(entryA?.totalPoints).toBeGreaterThanOrEqual(quest1.xpReward || quest1.pointValue);
  });

  it('3. TWO-WAY MULTIPLAYER STATE: Player B completes another quest, Player A sees updated leaderboard', async () => {
    const playerA = await upsertPlayerDB('Agent_Alpha_126', '⚡');
    const playerB = await upsertPlayerDB('Agent_Beta_330', '🧭');

    const quest2 = SEED_QUESTS.find((quest) => quest.id === 'qst-grand-finale-cipher')!;

    // Player B completes epic quest 2
    const submitB = await submitQuestProofDB({
      playerId: playerB.id,
      questId: quest2.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: 'CQ-FINAL-KEY',
    });

    expect(submitB.success).toBe(true);
    expect(submitB.awardedPoints).toBe(quest2.xpReward || quest2.pointValue);

    // Player A inspects leaderboard and progress
    const leaderboardForA = await getLeaderboardDB(SEED_EVENT.id);
    const entryB = leaderboardForA.find((e) => e.playerId === playerB.id);

    expect(entryB).toBeDefined();
    expect(entryB?.totalPoints).toBeGreaterThanOrEqual(quest2.xpReward || quest2.pointValue);
    expect(entryB?.rank).toBeGreaterThanOrEqual(1);
  });

  it('4. DUPLICATE SCORING GUARD: Blocks repeat point awards on backend engine', async () => {
    const playerA = await upsertPlayerDB('Agent_Alpha_126', '⚡');
    const quest = SEED_QUESTS[1]; // McKinley Monument (150 XP)

    // First attempt succeeds
    const first = await submitQuestProofDB({
      playerId: playerA.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1897',
      userLat: quest.location?.latitude,
      userLon: quest.location?.longitude,
    });
    expect(first.success).toBe(true);

    // Second attempt fails
    const second = await submitQuestProofDB({
      playerId: playerA.id,
      questId: quest.id,
      eventId: SEED_EVENT.id,
      proofType: 'passphrase',
      submittedContent: '1897',
      userLat: quest.location?.latitude,
      userLon: quest.location?.longitude,
    });
    expect(second.success).toBe(false);
    expect(second.awardedPoints).toBe(0);
    expect(second.message).toContain('already completed');
  });
});
