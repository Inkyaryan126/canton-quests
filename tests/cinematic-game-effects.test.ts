import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  gameMomentManager,
  showGameMoment,
  triggerQuestRewardSequence,
  GameMoment,
} from '../lib/game-effects';
import { proceduralSoundEngine } from '../lib/game-audio';

describe('Canton Quests — Futuristic Game Moments Engine', () => {
  beforeEach(() => {
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

  describe('2. Path Lock Moment', () => {
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
        if (current?.type === 'path-lock') {
          expect(current.path).toBe(p);
          expect(current.title).toContain(p.toUpperCase());
        }
      });
    });

    it('executes onFinished callback when dismissed', () => {
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

  describe('3. Quest Reward Sequence & Authoritative Rules', () => {
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
      if (current?.type === 'quest-complete') {
        expect(current.xpAwarded).toBe(350);
        expect(current.drawingEntriesAwarded).toBe(2);
        expect(current.questTitle).toBe('The Stone Stair Cipher');
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
        expect(stateA.queue[0].oldRank).toBe(15);
        expect(stateA.queue[0].newRank).toBe(8);
        expect(stateA.queue[0].tier).toBe('top10');
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

    it('assigns correct tier for Rank Up moments (first, top3, top10, normal)', () => {
      // Rank 1
      triggerQuestRewardSequence({
        questTitle: 'Apex Mission',
        xpAwarded: 500,
        oldRank: 3,
        newRank: 1,
      });
      expect(gameMomentManager.getState().queue[0].type).toBe('rank-up');
      if (gameMomentManager.getState().queue[0].type === 'rank-up') {
        expect((gameMomentManager.getState().queue[0] as any).tier).toBe('first');
      }

      // Rank 3 (Top 3)
      gameMomentManager.skipAll();
      triggerQuestRewardSequence({
        questTitle: 'Podium Mission',
        xpAwarded: 300,
        oldRank: 6,
        newRank: 3,
      });
      if (gameMomentManager.getState().queue[0].type === 'rank-up') {
        expect((gameMomentManager.getState().queue[0] as any).tier).toBe('top3');
      }

      // Rank 9 (Top 10)
      gameMomentManager.skipAll();
      triggerQuestRewardSequence({
        questTitle: 'Top 10 Mission',
        xpAwarded: 200,
        oldRank: 14,
        newRank: 9,
      });
      if (gameMomentManager.getState().queue[0].type === 'rank-up') {
        expect((gameMomentManager.getState().queue[0] as any).tier).toBe('top10');
      }

      // Rank 18 (Normal)
      gameMomentManager.skipAll();
      triggerQuestRewardSequence({
        questTitle: 'Normal Move',
        xpAwarded: 100,
        oldRank: 25,
        newRank: 18,
      });
      if (gameMomentManager.getState().queue[0].type === 'rank-up') {
        expect((gameMomentManager.getState().queue[0] as any).tier).toBe('normal');
      }
    });

    it('queues unlocked achievements and chain completions in sequence', () => {
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

      // Check sequence order by priority
      const types = state.queue.map((q) => q.type);
      expect(types).toEqual(['rank-up', 'achievement', 'chain-complete']);
    });
  });

  describe('4. Accessibility & Reduced Motion Mode', () => {
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

  describe('5. Procedural Sound Engine & Audio Muting', () => {
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
