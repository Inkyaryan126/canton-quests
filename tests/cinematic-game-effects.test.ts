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
} from '../lib/game-engine';

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

      // Check sequence order by priority: rank-up (90) -> achievement (85) -> chain-complete (70)
      const types = state.queue.map((q) => q.type);
      expect(types).toEqual(['rank-up', 'achievement', 'chain-complete']);

      const achMoment = state.queue[1];
      if (achMoment && achMoment.type === 'achievement') {
        const moment: AchievementMoment = achMoment;
        expect(moment.title).toBe('Arts Detective');
        expect(moment.icon).toBe('🎨');
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
});
