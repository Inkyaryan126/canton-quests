import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  gameMomentManager,
  showGameMoment,
  triggerQuestRewardSequence,
  RankUpMoment,
  QuestCompleteMoment,
  FinaleQualifiedMoment,
  FlashDropMoment,
  AchievementMoment,
  PathLockMoment,
} from '../lib/game-effects';
import { proceduralSoundEngine } from '../lib/game-audio';
import {
  initializeGameEngine,
  submitQuestProof,
  registerPlayer,
  getLeaderboardForEvent,
  awardDrawingEntries,
  lockDrawingLedger,
  getAuthenticatedPlayerDrawingQualification,
} from '../lib/game-engine';
import {
  getLeaderboardDB,
  getPlayerProgressDB,
  evaluatePlayerAchievementsDB,
  submitQuestProofDB,
  getAuthenticatedPlayerDrawingQualificationDB,
} from '../lib/supabase-db';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Canton Quests — Futuristic Game Moments Engine', () => {
  beforeEach(() => {
    initializeGameEngine();
    gameMomentManager.skipAll();
    gameMomentManager.setReducedMotion(false);
    gameMomentManager.setSoundEnabled(true);
  });

  afterEach(() => {
    gameMomentManager.skipAll();
    vi.restoreAllMocks();
  });

  describe('1. Game Moment Queue & State Manager', () => {
    it('initializes with empty queue and null current moment', () => {
      const state = gameMomentManager.getState();
      expect(state.currentMoment).toBeNull();
      expect(state.queue).toHaveLength(0);
      expect(state.isPaused).toBe(false);
    });

    it('triggers and sets current moment when queue is empty', () => {
      const id = showGameMoment({
        type: 'city-scan',
        district: 'Downtown Arts',
        targetCount: 14,
      });

      const state = gameMomentManager.getState();
      expect(state.currentMoment).not.toBeNull();
      expect(state.currentMoment?.type).toBe('city-scan');
      expect(state.currentMoment?.id).toBe(id);
      expect(state.queue).toHaveLength(0);
    });

    it('queues multiple moments and orders them by priority', () => {
      // Trigger first moment (city-scan, priority 50)
      showGameMoment({
        type: 'city-scan',
        targetCount: 10,
      });

      // Queue quest-complete (priority 80)
      showGameMoment({
        type: 'quest-complete',
        questTitle: 'The Counter-Sign at Aura',
        xpAwarded: 250,
      });

      // Queue rank-up (priority 90)
      showGameMoment({
        type: 'rank-up',
        oldRank: 15,
        newRank: 8,
        tier: 'top10',
      });

      // Queue finale-qualified (priority 100)
      showGameMoment({
        type: 'finale-qualified',
        qualifiedEntries: 5,
      });

      const state = gameMomentManager.getState();
      expect(state.currentMoment?.type).toBe('city-scan');
      expect(state.queue).toHaveLength(3);

      // Priority ordering in queue: finale-qualified (100) -> rank-up (90) -> quest-complete (80)
      expect(state.queue[0].type).toBe('finale-qualified');
      expect(state.queue[1].type).toBe('rank-up');
      expect(state.queue[2].type).toBe('quest-complete');
    });

    it('dismissCurrent advances queue cleanly without deadlocking', () => {
      showGameMoment({ type: 'city-scan', targetCount: 5 });
      showGameMoment({ type: 'path-lock', path: 'challenge' });
      showGameMoment({ type: 'achievement', achievementId: 'ach-1', title: 'Speed Demon', description: 'Solved in record time' });

      expect(gameMomentManager.getState().currentMoment?.type).toBe('city-scan');

      gameMomentManager.dismissCurrent();
      expect(gameMomentManager.getState().currentMoment?.type).toBe('achievement'); // higher priority than path-lock

      gameMomentManager.dismissCurrent();
      expect(gameMomentManager.getState().currentMoment?.type).toBe('path-lock');

      gameMomentManager.dismissCurrent();
      expect(gameMomentManager.getState().currentMoment).toBeNull();
      expect(gameMomentManager.getState().queue).toHaveLength(0);
    });

    it('skipAll clears both current moment and all queued moments immediately', () => {
      showGameMoment({ type: 'city-scan' });
      showGameMoment({ type: 'rank-up', oldRank: 10, newRank: 5 });
      showGameMoment({ type: 'achievement', achievementId: 'a2', title: 'Explorer', description: 'All zones' });

      expect(gameMomentManager.getState().queue).toHaveLength(2);

      gameMomentManager.skipAll();
      const state = gameMomentManager.getState();
      expect(state.currentMoment).toBeNull();
      expect(state.queue).toHaveLength(0);
    });
  });

  describe('2. Path Lock Moment & Onboarding Integration', () => {
    it('preserves path attribute and metadata for Family, Challenge, and Secret', () => {
      const paths = ['family', 'challenge', 'secret'] as const;

      paths.forEach((p) => {
        gameMomentManager.skipAll();
        showGameMoment({
          type: 'path-lock',
          path: p,
          title: `${p.toUpperCase()} ADVENTURE`,
          district: 'Canton Central',
        });

        const current = gameMomentManager.getState().currentMoment;
        expect(current?.type).toBe('path-lock');
        if (current && current.type === 'path-lock') {
          const pathMoment: PathLockMoment = current;
          expect(pathMoment.path).toBe(p);
          expect(pathMoment.title).toContain(p.toUpperCase());
        }
      });
    });

    it('executes onFinished callback when dismissed, protecting onboarding navigation', () => {
      const onFinishedSpy = vi.fn();
      showGameMoment({
        type: 'path-lock',
        path: 'family',
        onFinished: onFinishedSpy,
      });

      gameMomentManager.dismissCurrent();
      expect(onFinishedSpy).toHaveBeenCalledTimes(1);
    });

    it('executes onFinished callback when skipped via skipAll(), ensuring deterministic lifecycle', () => {
      const onFinishedSpy = vi.fn();
      showGameMoment({
        type: 'path-lock',
        path: 'challenge',
        onFinished: onFinishedSpy,
      });

      expect(gameMomentManager.getState().currentMoment?.type).toBe('path-lock');
      gameMomentManager.skipAll();
      expect(onFinishedSpy).toHaveBeenCalledTimes(1);
      expect(gameMomentManager.getState().currentMoment).toBeNull();
    });

    it('supports onFinished callback on general BaseGameMoment types', () => {
      const onFinishedSpy = vi.fn();
      showGameMoment({
        type: 'finale-qualified',
        qualifiedEntries: 3,
        onFinished: onFinishedSpy,
      });

      expect(gameMomentManager.getState().currentMoment?.type).toBe('finale-qualified');
      gameMomentManager.dismissCurrent();
      expect(onFinishedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Quest Reward Sequence & Server Authoritative Data', () => {
    it('triggers Quest Complete with exact server-authoritative XP and drawing tickets', () => {
      triggerQuestRewardSequence({
        questId: 'q-101',
        questTitle: 'The Stone Stair Cipher',
        xpAwarded: 350,
        verificationType: 'cipher',
        drawingEntriesAwarded: 2,
      });

      const current = gameMomentManager.getState().currentMoment;
      expect(current?.type).toBe('quest-complete');
      if (current && current.type === 'quest-complete') {
        const questMoment: QuestCompleteMoment = current;
        expect(questMoment.xpAwarded).toBe(350);
        expect(questMoment.drawingEntriesAwarded).toBe(2);
        expect(questMoment.questTitle).toBe('The Stone Stair Cipher');
      }
    });

    it('queues Rank Up only when rank strictly improved (newRank < oldRank)', () => {
      // Scenario A: Rank improved from 15 to 8
      triggerQuestRewardSequence({
        questTitle: 'Mural Hunter',
        xpAwarded: 200,
        oldRank: 15,
        newRank: 8,
      });

      const stateA = gameMomentManager.getState();
      expect(stateA.currentMoment?.type).toBe('quest-complete');
      expect(stateA.queue).toHaveLength(1);
      expect(stateA.queue[0].type).toBe('rank-up');
      if (stateA.queue[0].type === 'rank-up') {
        const rankMoment: RankUpMoment = stateA.queue[0];
        expect(rankMoment.oldRank).toBe(15);
        expect(rankMoment.newRank).toBe(8);
        expect(rankMoment.tier).toBe('top10');
      }

      // Scenario B: Rank did NOT improve (same rank or lower)
      gameMomentManager.skipAll();
      triggerQuestRewardSequence({
        questTitle: 'Mural Hunter',
        xpAwarded: 200,
        oldRank: 12,
        newRank: 12, // no change
      });

      const stateB = gameMomentManager.getState();
      expect(stateB.currentMoment?.type).toBe('quest-complete');
      expect(stateB.queue).toHaveLength(0); // rank-up should NOT be queued
    });

    it('assigns correct typed tier for Rank Up moments without using weak type shortcuts', () => {
      // Rank 1
      triggerQuestRewardSequence({
        questTitle: 'Apex Mission',
        xpAwarded: 500,
        oldRank: 3,
        newRank: 1,
      });
      const firstMoment = gameMomentManager.getState().queue[0];
      expect(firstMoment?.type).toBe('rank-up');
      if (firstMoment && firstMoment.type === 'rank-up') {
        const rankMoment: RankUpMoment = firstMoment;
        expect(rankMoment.tier).toBe('first');
      }

      // Rank 3 (Top 3)
      gameMomentManager.skipAll();
      triggerQuestRewardSequence({
        questTitle: 'Podium Mission',
        xpAwarded: 300,
        oldRank: 6,
        newRank: 3,
      });
      const top3Moment = gameMomentManager.getState().queue[0];
      if (top3Moment && top3Moment.type === 'rank-up') {
        const rankMoment: RankUpMoment = top3Moment;
        expect(rankMoment.tier).toBe('top3');
      }

      // Rank 9 (Top 10)
      gameMomentManager.skipAll();
      triggerQuestRewardSequence({
        questTitle: 'Top 10 Mission',
        xpAwarded: 200,
        oldRank: 14,
        newRank: 9,
      });
      const top10Moment = gameMomentManager.getState().queue[0];
      if (top10Moment && top10Moment.type === 'rank-up') {
        const rankMoment: RankUpMoment = top10Moment;
        expect(rankMoment.tier).toBe('top10');
      }

      // Rank 18 (Normal)
      gameMomentManager.skipAll();
      triggerQuestRewardSequence({
        questTitle: 'Normal Move',
        xpAwarded: 100,
        oldRank: 25,
        newRank: 18,
      });
      const normalMoment = gameMomentManager.getState().queue[0];
      if (normalMoment && normalMoment.type === 'rank-up') {
        const rankMoment: RankUpMoment = normalMoment;
        expect(rankMoment.tier).toBe('normal');
      }
    });

    it('queues newly unlocked achievements and chain completions sequentially', () => {
      triggerQuestRewardSequence({
        questTitle: '4th Street Mural',
        xpAwarded: 250,
        oldRank: 12,
        newRank: 5,
        newAchievements: [
          {
            id: 'ach-arts-master',
            title: 'Arts Detective',
            description: 'Found all 3 downtown murals',
            icon: '🎨',
            rewardXp: 100,
          },
        ],
        isChainComplete: true,
        chainTitle: 'The Downtown Arts Loop',
      });

      const state = gameMomentManager.getState();
      expect(state.currentMoment?.type).toBe('quest-complete');
      expect(state.queue).toHaveLength(3); // rank-up, achievement, chain-complete

      // Check sequence order: rank-up -> achievement -> chain-complete
      const types = state.queue.map((q) => q.type);
      expect(types).toEqual(['rank-up', 'achievement', 'chain-complete']);

      const achMoment = state.queue[1];
      if (achMoment && achMoment.type === 'achievement') {
        const moment: AchievementMoment = achMoment;
        expect(moment.title).toBe('Arts Detective');
        expect(moment.icon).toBe('🎨');
      }
    });

    it('preserves atomic FIFO reward sequence (quest-complete -> rank-up -> achievement -> chain-complete) when an overlay is ALREADY active', () => {
      // 1. Activate an initial moment (e.g. City Scan overlay is active)
      showGameMoment({
        type: 'city-scan',
        district: 'Downtown Arts',
        targetCount: 8,
      });

      expect(gameMomentManager.getState().currentMoment?.type).toBe('city-scan');

      // 2. Trigger quest reward sequence while city-scan overlay is still showing
      triggerQuestRewardSequence({
        questId: 'qst-cipher-01',
        questTitle: 'The Stone Stair Cipher',
        xpAwarded: 350,
        verificationType: 'cipher',
        drawingEntriesAwarded: 2,
        oldRank: 18,
        newRank: 7, // triggers rank-up (tier: top10, priority 90)
        newAchievements: [
          {
            id: 'ach-first-cipher',
            title: 'Cipher Initiate',
            description: 'Cracked first ancient cipher in Monument Park',
            icon: '🗝️',
            rewardXp: 50,
          },
        ],
        isChainComplete: true,
        chainTitle: 'The Monument Park Cipher Line',
      });

      const stateWithActiveScan = gameMomentManager.getState();
      expect(stateWithActiveScan.currentMoment?.type).toBe('city-scan');
      expect(stateWithActiveScan.queue).toHaveLength(4);

      // Crucial requirement: quest-complete MUST NOT be jumped by rank-up or achievement in the queue!
      const queuedTypes = stateWithActiveScan.queue.map((m) => m.type);
      expect(queuedTypes).toEqual([
        'quest-complete',
        'rank-up',
        'achievement',
        'chain-complete',
      ]);

      // 3. Step through moments sequentially upon dismissal
      // Step A: Dismiss City Scan -> reveals Quest Complete (+350 XP)
      gameMomentManager.dismissCurrent();
      const momentA = gameMomentManager.getState().currentMoment;
      expect(momentA?.type).toBe('quest-complete');
      if (momentA && momentA.type === 'quest-complete') {
        expect(momentA.xpAwarded).toBe(350);
        expect(momentA.questTitle).toBe('The Stone Stair Cipher');
      }

      // Step B: Dismiss Quest Complete -> reveals Rank Up (#18 -> #7)
      gameMomentManager.dismissCurrent();
      const momentB = gameMomentManager.getState().currentMoment;
      expect(momentB?.type).toBe('rank-up');
      if (momentB && momentB.type === 'rank-up') {
        expect(momentB.oldRank).toBe(18);
        expect(momentB.newRank).toBe(7);
        expect(momentB.tier).toBe('top10');
      }

      // Step C: Dismiss Rank Up -> reveals Achievement Unlock (Cipher Initiate)
      gameMomentManager.dismissCurrent();
      const momentC = gameMomentManager.getState().currentMoment;
      expect(momentC?.type).toBe('achievement');
      if (momentC && momentC.type === 'achievement') {
        expect(momentC.title).toBe('Cipher Initiate');
      }

      // Step D: Dismiss Achievement -> reveals Quest Chain Complete
      gameMomentManager.dismissCurrent();
      const momentD = gameMomentManager.getState().currentMoment;
      expect(momentD?.type).toBe('chain-complete');
      if (momentD && momentD.type === 'chain-complete') {
        expect(momentD.chainTitle).toBe('The Monument Park Cipher Line');
      }

      // Step E: Dismiss Chain Complete -> finishes all moments cleanly
      gameMomentManager.dismissCurrent();
      expect(gameMomentManager.getState().currentMoment).toBeNull();
      expect(gameMomentManager.getState().queue).toHaveLength(0);
    });

    it('intermediate chain progression reveals next objective in quest-complete without queuing a false chain-complete moment', () => {
      gameMomentManager.skipAll();

      // Intermediate quest solved: unlocks next quest in chain, but isChainComplete is false
      triggerQuestRewardSequence({
        questId: 'qst-onesto-brass-motto',
        questTitle: 'The Onesto Brass Motto',
        xpAwarded: 150,
        unlockedQuestTitle: 'The Secrets of 4th Street',
        unlockedQuestUrl: '/events/canton-weekend-1/quests/qst-secret-cipher-77',
        isChainComplete: false,
      });

      const state = gameMomentManager.getState();
      expect(state.currentMoment?.type).toBe('quest-complete');
      if (state.currentMoment && state.currentMoment.type === 'quest-complete') {
        expect(state.currentMoment.unlockedQuestTitle).toBe('The Secrets of 4th Street');
        expect(state.currentMoment.unlockedQuestUrl).toBe('/events/canton-weekend-1/quests/qst-secret-cipher-77');
      }

      // Assert queue has ZERO chain-complete moments
      expect(state.queue).toHaveLength(0);
      expect(state.queue.some((m) => m.type === 'chain-complete')).toBe(false);
    });

    it('terminal quest completion or multi-step chain completion triggers chain-complete moment', () => {
      gameMomentManager.skipAll();

      // Terminal / multi-step chain completed: isChainComplete is true
      triggerQuestRewardSequence({
        questId: 'qst-secret-cipher-77',
        questTitle: 'The Secrets of 4th Street',
        xpAwarded: 350,
        isChainComplete: true,
        chainTitle: 'The Secrets of 4th Street Sequence',
      });

      const state = gameMomentManager.getState();
      expect(state.currentMoment?.type).toBe('quest-complete');
      expect(state.queue).toHaveLength(1);
      expect(state.queue[0].type).toBe('chain-complete');
      if (state.queue[0].type === 'chain-complete') {
        const chainMoment = state.queue[0];
        expect(chainMoment.chainTitle).toBe('The Secrets of 4th Street Sequence');
      }
    });
  });

  describe('4. End-to-End Game Engine & Submission Integration', () => {
    it('submitQuestProof computes authoritative rank deltas and newly earned achievements', () => {
      const player = registerPlayer({
        displayName: 'QuestMaster_330',
        selectedStartingPath: 'family',
      });

      // Submit first quest: Centennial Discovery
      const res = submitQuestProof({
        playerId: player.id,
        questId: 'qst-centennial-discovery',
        eventId: 'evt-canton-vol-1',
        proofType: 'gps',
        userLat: 40.7989,
        userLon: -81.3745,
      });

      expect(res.success).toBe(true);
      expect(res.awardedPoints).toBeGreaterThan(0);
      expect(res.drawingEntriesAwarded).toBe(1);
      expect(res.newRank).toBeDefined();
      expect(res.newAchievements).toBeDefined();
      expect(res.newAchievements?.some((a) => a.id.includes('pathfinder-family'))).toBe(true);
    });

    it('failed submissions award 0 XP and 0 drawing entries with zero reward sequence triggers', () => {
      const player = registerPlayer({
        displayName: 'FailedAgent_330',
      });

      // Submit invalid passphrase
      const res = submitQuestProof({
        playerId: player.id,
        questId: 'qst-mckinley-cipher',
        eventId: 'evt-canton-vol-1',
        proofType: 'passphrase',
        submittedContent: 'WRONG_CODE_123',
        userLat: 40.8078,
        userLon: -81.3934,
      });

      expect(res.success).toBe(false);
      expect(res.awardedPoints).toBe(0);
      expect(res.drawingEntriesAwarded).toBe(0);
      expect(res.newAchievements).toBeUndefined();
    });
  });

  describe('5. Flash Drop Live Quest Alert', () => {
    it('shows flash-drop moment with accurate quest details and district', () => {
      showGameMoment({
        type: 'flash-drop',
        questId: 'qst-flash-01',
        questTitle: 'Sprint to Palace Theatre',
        pointValue: 400,
        district: 'Downtown Arts Corridor',
        questUrl: '/events/canton-weekend-1/quests/qst-flash-01',
      });

      const current = gameMomentManager.getState().currentMoment;
      expect(current?.type).toBe('flash-drop');
      if (current && current.type === 'flash-drop') {
        const flashMoment: FlashDropMoment = current;
        expect(flashMoment.questTitle).toBe('Sprint to Palace Theatre');
        expect(flashMoment.pointValue).toBe(400);
        expect(flashMoment.district).toBe('Downtown Arts Corridor');
      }
    });
  });

  describe('6. Finale Qualification Ceremony', () => {
    it('shows finale-qualified moment with player-specific entries and ticket range', () => {
      showGameMoment({
        type: 'finale-qualified',
        playerLabel: 'ChampionVoyager_330',
        qualifiedEntries: 7,
        ticketRange: 'Tickets #42 - #48',
        snapshotHash: 'sha256:abcd1234ef5678',
        eventTitle: 'Canton Quests: Volume 1 — The Founder’s Cipher',
        isLocked: true,
      });

      const current = gameMomentManager.getState().currentMoment;
      expect(current?.type).toBe('finale-qualified');
      if (current && current.type === 'finale-qualified') {
        const finaleMoment: FinaleQualifiedMoment = current;
        expect(finaleMoment.playerLabel).toBe('ChampionVoyager_330');
        expect(finaleMoment.qualifiedEntries).toBe(7);
        expect(finaleMoment.ticketRange).toBe('Tickets #42 - #48');
        expect(finaleMoment.snapshotHash).toContain('sha256:');
      }
    });

    it('shows finale-qualified standby moment when player has 0 verified entries', () => {
      showGameMoment({
        type: 'finale-qualified',
        playerLabel: 'UnregisteredGuest',
        qualifiedEntries: 0,
        ticketRange: 'No verified quest completions yet',
        eventTitle: 'Canton Quests: Volume 1 — The Founder’s Cipher',
        isLocked: false,
      });

      const current = gameMomentManager.getState().currentMoment;
      expect(current?.type).toBe('finale-qualified');
      if (current && current.type === 'finale-qualified') {
        const finaleMoment: FinaleQualifiedMoment = current;
        expect(finaleMoment.playerLabel).toBe('UnregisteredGuest');
        expect(finaleMoment.qualifiedEntries).toBe(0);
        expect(finaleMoment.ticketRange).toBe('No verified quest completions yet');
      }
    });

    it('resolves server-authoritative drawing qualification by exact player identity, preventing duplicate display name confusion', async () => {
      // Create two players with identical display names
      const player1 = registerPlayer({
        displayName: 'Canton Explorer',
        avatarUrl: '⚡',
        selectedStartingPath: 'family',
      });
      const player2 = registerPlayer({
        displayName: 'Canton Explorer',
        avatarUrl: '🎯',
        selectedStartingPath: 'challenge',
      });

      expect(player1.id).not.toBe(player2.id);
      expect(player1.displayName).toBe(player2.displayName);

      // Award drawing entries ONLY to player1
      awardDrawingEntries({
        eventId: 'evt-canton-vol-1',
        playerId: player1.id,
        entriesCount: 4,
        reason: 'Completed 4 quests',
      });

      // Test local engine lookup
      const qual1 = getAuthenticatedPlayerDrawingQualification(player1.id, 'evt-canton-vol-1');
      const qual2 = getAuthenticatedPlayerDrawingQualification(player2.id, 'evt-canton-vol-1');

      expect(qual1).not.toBeNull();
      expect(qual1?.playerId).toBe(player1.id);
      expect(qual1?.qualifiedEntries).toBe(4);
      expect(qual1?.isQualified).toBe(true);
      expect(qual1?.ticketRange).toBe('4 Verified Tickets');

      expect(qual2).not.toBeNull();
      expect(qual2?.playerId).toBe(player2.id);
      expect(qual2?.qualifiedEntries).toBe(0);
      expect(qual2?.isQualified).toBe(false);
      expect(qual2?.ticketRange).toBe('No verified quest completions yet');

      // Test unified DB-layer lookup
      const dbQual1 = await getAuthenticatedPlayerDrawingQualificationDB(player1.id, 'evt-canton-vol-1');
      const dbQual2 = await getAuthenticatedPlayerDrawingQualificationDB(player2.id, 'evt-canton-vol-1');

      expect(dbQual1?.qualifiedEntries).toBe(4);
      expect(dbQual2?.qualifiedEntries).toBe(0);
    });

    it('derives accurate ticket ranges when drawing ledger is locked without exposing or misattributing other players', async () => {
      const playerA = registerPlayer({
        displayName: 'Alpha Player',
        avatarUrl: '⚡',
      });
      const playerB = registerPlayer({
        displayName: 'Beta Player',
        avatarUrl: '🔥',
      });

      awardDrawingEntries({
        eventId: 'evt-canton-vol-1',
        playerId: playerA.id,
        entriesCount: 3,
        reason: 'Alpha entries',
      });
      awardDrawingEntries({
        eventId: 'evt-canton-vol-1',
        playerId: playerB.id,
        entriesCount: 2,
        reason: 'Beta entries',
      });

      lockDrawingLedger('evt-canton-vol-1', { lockReason: 'Test Lock', lockedBy: 'GM' });

      const qualA = getAuthenticatedPlayerDrawingQualification(playerA.id, 'evt-canton-vol-1');
      const qualB = getAuthenticatedPlayerDrawingQualification(playerB.id, 'evt-canton-vol-1');

      expect(qualA?.qualifiedEntries).toBe(3);
      expect(qualA?.ticketRange).toMatch(/Tickets #\d+ - #\d+/);
      expect(qualB?.qualifiedEntries).toBe(2);
      expect(qualB?.ticketRange).toMatch(/Tickets #\d+ - #\d+/);
      expect(qualA?.ticketRange).not.toBe(qualB?.ticketRange);

      // Unregistered / invalid player returns null
      const qualNonexistent = getAuthenticatedPlayerDrawingQualification('nonexistent-player-uuid', 'evt-canton-vol-1');
      expect(qualNonexistent).toBeNull();
    });

    it('drawing frontend and API verify qualification authoritatively without client-side displayName matching', () => {
      const pageCode = readFileSync(join(process.cwd(), 'app/events/[slug]/drawing/page.tsx'), 'utf-8');
      const routeCode = readFileSync(join(process.cwd(), 'app/api/game/events/[slug]/drawing/route.ts'), 'utf-8');

      // Ensure API resolves authenticated player
      expect(routeCode).toContain('resolveAuthenticatedPlayer');
      expect(routeCode).toContain('getAuthenticatedPlayerDrawingQualificationDB');
      expect(routeCode).toContain('authenticatedPlayerQualification');

      // Ensure frontend consumes authenticatedPlayerQualification and does NOT do client-side guessing
      expect(pageCode).toContain('authenticatedPlayerQualification');
      expect(pageCode).not.toContain('e.playerPublicLabel === currentPlayer.displayName');
      expect(pageCode).not.toContain('e.playerPublicLabel.includes(currentPlayer.id.slice');
    });
  });

  describe('7. Accessibility & Reduced Motion Mode', () => {
    it('sets reducedMotion and adapts default moment durations', () => {
      gameMomentManager.setReducedMotion(true);
      expect(gameMomentManager.getState().reducedMotion).toBe(true);

      showGameMoment({
        type: 'quest-complete',
        questTitle: 'Fast Checkin',
        xpAwarded: 100,
      });

      const current = gameMomentManager.getState().currentMoment;
      expect(current?.durationMs).toBe(2000); // 2000ms in reduced motion vs 3200ms default
    });

    it('verifies SectorMap and globals.css have explicit prefers-reduced-motion overrides for all continuous HUD animations', () => {
      const sectorMapCode = readFileSync(join(process.cwd(), 'components/SectorMap.tsx'), 'utf-8');
      const globalsCss = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf-8');

      // SectorMap reduced motion overrides
      expect(sectorMapCode).toContain('@media (prefers-reduced-motion: reduce)');
      expect(sectorMapCode).toContain('.radar-sweep');
      expect(sectorMapCode).toContain('.top-label .dot');
      expect(sectorMapCode).toContain('.quest-pin .ring.pulse');
      expect(sectorMapCode).toContain('.ticker-item');

      // globals.css reduced motion overrides
      expect(globalsCss).toContain('@media (prefers-reduced-motion: reduce)');
      expect(globalsCss).toContain('.cq-hud-scanline');
    });
  });

  describe('8. Procedural Sound Engine & Audio Muting', () => {
    it('toggles sound preference and preserves state', () => {
      expect(gameMomentManager.getState().soundEnabled).toBe(true);
      const isMutedNow = !gameMomentManager.toggleSound();
      expect(isMutedNow).toBe(true);
      expect(gameMomentManager.getState().soundEnabled).toBe(false);

      gameMomentManager.toggleSound();
      expect(gameMomentManager.getState().soundEnabled).toBe(true);
    });

    it('sound methods execute safely without throwing errors in test environment', () => {
      expect(() => {
        proceduralSoundEngine.playCityScan();
        proceduralSoundEngine.playPathLock('family');
        proceduralSoundEngine.playPathLock('challenge');
        proceduralSoundEngine.playPathLock('secret');
        proceduralSoundEngine.playQuestComplete(250);
        proceduralSoundEngine.playRankUp('top10');
        proceduralSoundEngine.playAchievement();
        proceduralSoundEngine.playFlashDrop();
        proceduralSoundEngine.playFinaleQualified();
      }).not.toThrow();
    });
  });

  describe('9. Unified Database / Server Layer Integration & Authoritative Reward Deltas', () => {
    it('getLeaderboardDB returns valid leaderboard entries with ranks via unified DB layer', async () => {
      const leaderboard = await getLeaderboardDB('canton-weekend-1');
      expect(Array.isArray(leaderboard)).toBe(true);
      if (leaderboard.length > 0) {
        expect(leaderboard[0].rank).toBe(1);
        expect(leaderboard[0].playerId).toBeDefined();
        expect(typeof leaderboard[0].totalPoints).toBe('number');
      }
    });

    it('getPlayerProgressDB derives player progress and finale qualification correctly via unified DB layer', async () => {
      const player = registerPlayer({
        displayName: `DB_Progress_Agent_${Date.now()}`,
        selectedStartingPath: 'secret',
        avatarUrl: '⚡',
      });
      const progress = await getPlayerProgressDB(player.id, 'canton-weekend-1');
      expect(progress).toBeDefined();
      expect(typeof progress.totalPoints).toBe('number');
      expect(Array.isArray(progress.completedQuestIds)).toBe(true);
      expect(typeof progress.rank).toBe('number');
    });

    it('evaluatePlayerAchievementsDB evaluates achievements without throwing via unified DB layer', async () => {
      const player = registerPlayer({
        displayName: `DB_Achievement_Agent_${Date.now()}`,
        selectedStartingPath: 'family',
        avatarUrl: '🏆',
      });
      const awarded = await evaluatePlayerAchievementsDB(player.id, 'canton-weekend-1');
      expect(Array.isArray(awarded)).toBe(true);
    });

    it('submitQuestProofDB returns server-authoritative reward deltas and verified completion via unified DB layer', async () => {
      const player = registerPlayer({
        displayName: `DB_Submit_Agent_${Date.now()}`,
        selectedStartingPath: 'challenge',
        avatarUrl: '⚔️',
      });
      const res = await submitQuestProofDB({
        playerId: player.id,
        questId: 'qst-centennial-discovery',
        eventId: 'canton-weekend-1',
        proofType: 'checkin',
        submittedContent: 'GPS Checkin Confirmed',
        userLat: 40.7989,
        userLon: -81.3748,
      });

      expect(res.success).toBe(true);
      expect(res.awardedPoints).toBeGreaterThan(0);
      expect(res.isQuestFullyCompleted).toBe(true);
      expect(res.submission).toBeDefined();
    });
  });

  describe('10. Lifecycle Cleanup & Rapid Route Transition Robustness', () => {
    it('handles rapid sequential triggers and dismissals without leaving stale queue items or timer leaks', () => {
      for (let i = 0; i < 10; i++) {
        showGameMoment({
          type: 'city-scan',
          targetCount: i + 1,
        });
      }

      const state = gameMomentManager.getState();
      expect(state.currentMoment).not.toBeNull();
      expect(state.queue.length).toBe(9);

      // Fast-forward / skipAll cleans up timers and empty queue
      gameMomentManager.skipAll();
      const clearedState = gameMomentManager.getState();
      expect(clearedState.currentMoment).toBeNull();
      expect(clearedState.queue).toHaveLength(0);
    });
  });

  describe('11. Quest List City Scan & Pre-Load Protection', () => {
    it('verifies QuestListScanEffect and QuestsPage source codes handle isLoading and avoid 0-target dedupe', () => {
      const scanEffectCode = readFileSync(join(process.cwd(), 'components/game-effects/QuestListScanEffect.tsx'), 'utf-8');
      const questsPageCode = readFileSync(join(process.cwd(), 'app/quests/page.tsx'), 'utf-8');

      // Ensure QuestListScanEffect interface includes isLoading prop
      expect(scanEffectCode).toContain('isLoading?: boolean');
      expect(scanEffectCode).toContain('if (!autoScanOnMount || isLoading) return;');
      expect(scanEffectCode).toContain('sessionStorage.getItem(\'cq_has_scanned_quests\')');
      expect(scanEffectCode).toContain('sessionStorage.setItem(\'cq_has_scanned_quests\', \'true\')');

      // Ensure QuestsPage tracks isLoadingQuests and passes it to QuestListScanEffect
      expect(questsPageCode).toContain('const [isLoadingQuests, setIsLoadingQuests] = useState(true);');
      expect(questsPageCode).toContain('isLoading={isLoadingQuests}');
      expect(questsPageCode).toContain('setIsLoadingQuests(false)');
    });

    it('simulates pre-load state: does not trigger scan or set dedupe flag while loading with 0 quests', () => {
      // Mock sessionStorage
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
      };
      vi.stubGlobal('sessionStorage', storageMock);

      // Simulate pre-load condition: loading is true, count is 0
      const autoScanOnMount = true;
      let isLoading = true;
      let questCount = 0;
      const districtName = 'ALL CANTON DISTRICTS';

      function simulateScanEffectMount() {
        if (!autoScanOnMount || isLoading) return;
        const hasScanned = storageMock.getItem('cq_has_scanned_quests');
        if (!hasScanned) {
          storageMock.setItem('cq_has_scanned_quests', 'true');
          showGameMoment({
            type: 'city-scan',
            district: districtName,
            targetCount: questCount,
            manualTrigger: false,
          });
        }
      }

      // Initial pre-load render
      simulateScanEffectMount();
      expect(storageMock.getItem('cq_has_scanned_quests')).toBeNull();
      expect(gameMomentManager.getState().currentMoment).toBeNull();

      // Data finish loading: 14 quests arrive, isLoading becomes false
      isLoading = false;
      questCount = 14;
      simulateScanEffectMount();

      // Now scan should be triggered with exact count (14) and dedupe flag recorded
      expect(storageMock.getItem('cq_has_scanned_quests')).toBe('true');
      const state = gameMomentManager.getState();
      expect(state.currentMoment?.type).toBe('city-scan');
      if (state.currentMoment?.type === 'city-scan') {
        expect(state.currentMoment.targetCount).toBe(14);
        expect(state.currentMoment.district).toBe('ALL CANTON DISTRICTS');
      }

      // Subsequent re-renders do NOT re-trigger automatic scan
      gameMomentManager.skipAll();
      simulateScanEffectMount();
      expect(gameMomentManager.getState().currentMoment).toBeNull();
    });
  });
});
