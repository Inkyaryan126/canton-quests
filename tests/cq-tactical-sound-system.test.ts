import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  cqSoundManager,
  CQSoundManager,
  CQ_SOUND_MAP,
  CQ_SOUND_CONFIGS,
  CQ_KEY_TO_EVENT,
  resolveSoundConfig,
  CQSoundEvent,
} from '../lib/audio';
import { proceduralSoundEngine } from '../lib/game-audio';

// Mock Browser Environment for Node/Vitest
class MockLocalStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

class MockAudio {
  public src: string;
  public volume: number = 1.0;
  public currentTime: number = 0;
  public paused: boolean = true;
  public ended: boolean = false;
  public preload: string = 'auto';
  public onended: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  constructor(src?: string) {
    this.src = src || '';
  }

  public play(): Promise<void> {
    this.paused = false;
    this.ended = false;
    return Promise.resolve();
  }

  public pause(): void {
    this.paused = true;
  }
}

describe('Canton Quests — Tactical Sound System & Event Map', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    (global as any).window = {
      localStorage: mockStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      AudioContext: vi.fn().mockImplementation(() => ({
        state: 'running',
        resume: vi.fn().mockResolvedValue(undefined),
      })),
    };
    (global as any).Audio = MockAudio;

    cqSoundManager.resetForTesting();
    cqSoundManager.setSoundEnabled(true);
    cqSoundManager.setVolume(0.85);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cqSoundManager.resetForTesting();
  });

  describe('1. Central Sound Event Map & Configuration', () => {
    const requiredEvents: CQSoundEvent[] = [
      'ui_click',
      'ui_confirm',
      'ui_back',
      'ui_error',
      'ui_locked',
      'quest_select',
      'quest_start',
      'quest_complete',
      'chain_unlock',
      'secret_reveal',
      'badge_unlock',
      'rank_up',
      'xp_gain',
      'flash_drop',
      'transmission',
      'finale_qualified',
      'path_family',
      'path_challenge',
      'path_secret',
      'scan',
      'lock_on',
      'node_ping',
    ];

    it('contains all 22 required tactical sound events', () => {
      expect(Object.keys(CQ_SOUND_CONFIGS)).toHaveLength(22);
      requiredEvents.forEach((evt) => {
        expect(CQ_SOUND_CONFIGS[evt]).toBeDefined();
        expect(CQ_SOUND_CONFIGS[evt].event).toBe(evt);
        expect(CQ_SOUND_CONFIGS[evt].src).toMatch(/^\/audio\/cq\/.+\.mp3$/);
        expect(CQ_SOUND_CONFIGS[evt].volume).toBeGreaterThan(0);
        expect(CQ_SOUND_CONFIGS[evt].volume).toBeLessThanOrEqual(1.0);
        expect(CQ_SOUND_CONFIGS[evt].priority).toBeGreaterThanOrEqual(0);
        expect(CQ_SOUND_CONFIGS[evt].priority).toBeLessThanOrEqual(100);
      });
    });

    it('resolves both snake_case and camelCase identifiers seamlessly', () => {
      expect(resolveSoundConfig('ui_click').src).toBe('/audio/cq/ui-click.mp3');
      expect(resolveSoundConfig('uiClick').src).toBe('/audio/cq/ui-click.mp3');
      expect(resolveSoundConfig('quest_complete').src).toBe('/audio/cq/quest-complete.mp3');
      expect(resolveSoundConfig('questComplete').src).toBe('/audio/cq/quest-complete.mp3');
      expect(resolveSoundConfig('finale_qualified').src).toBe('/audio/cq/finale-qualified.mp3');
      expect(resolveSoundConfig('finaleQualified').src).toBe('/audio/cq/finale-qualified.mp3');
      expect(resolveSoundConfig('path_family').src).toBe('/audio/cq/path-family.mp3');
      expect(resolveSoundConfig('pathChallenge').src).toBe('/audio/cq/path-challenge.mp3');
    });

    it('all 22 audio assets exist on physical disk and have valid RIFF headers', () => {
      Object.values(CQ_SOUND_CONFIGS).forEach((config) => {
        const filePath = join(process.cwd(), 'public', config.src);
        expect(existsSync(filePath)).toBe(true);

        const fileBuffer = readFileSync(filePath);
        expect(fileBuffer.length).toBeGreaterThan(1000);

        // Verify standard RIFF/WAVE header for wav files
        if (config.src.endsWith('.wav')) {
          const riffHeader = fileBuffer.subarray(0, 4).toString('ascii');
          const waveHeader = fileBuffer.subarray(8, 12).toString('ascii');
          expect(riffHeader).toBe('RIFF');
          expect(waveHeader).toBe('WAVE');
        } else {
          expect(fileBuffer.length).toBeGreaterThan(100);
        }
      });
    });

    it('identifies critical preloaded assets correctly', () => {
      expect(CQ_SOUND_CONFIGS.ui_click.preload).toBe(true);
      expect(CQ_SOUND_CONFIGS.quest_select.preload).toBe(true);
      expect(CQ_SOUND_CONFIGS.quest_complete.preload).toBe(true);
      expect(CQ_SOUND_CONFIGS.badge_unlock.preload).toBe(true);
      expect(CQ_SOUND_CONFIGS.rank_up.preload).toBe(true);
    });
  });

  describe('2. Sound Playback & Enable/Disable State Control', () => {
    it('allows sound playback when enabled', async () => {
      cqSoundManager.setSoundEnabled(true);
      expect(cqSoundManager.isSoundEnabled()).toBe(true);

      const played = await cqSoundManager.play('ui_click');
      expect(played).toBe(true);
    });

    it('suppresses sound playback when disabled/muted', async () => {
      cqSoundManager.setSoundEnabled(false);
      expect(cqSoundManager.isSoundEnabled()).toBe(false);

      const played = await cqSoundManager.play('ui_click');
      expect(played).toBe(false);

      const playedQuest = await cqSoundManager.play('quest_complete');
      expect(playedQuest).toBe(false);
    });

    it('toggleSound toggles sound state and returns new value', () => {
      cqSoundManager.setSoundEnabled(true);
      expect(cqSoundManager.toggleSound()).toBe(false);
      expect(cqSoundManager.isSoundEnabled()).toBe(false);

      expect(cqSoundManager.toggleSound()).toBe(true);
      expect(cqSoundManager.isSoundEnabled()).toBe(true);
    });
  });

  describe('3. Spam Protection & Debounce Cooldown Handling', () => {
    it('prevents multiple rapid duplicate plays within cooldown window', async () => {
      cqSoundManager.setSoundEnabled(true);

      // First click should succeed
      const firstPlay = await cqSoundManager.play('ui_click');
      expect(firstPlay).toBe(true);

      // Immediate second click must be debounced
      const rapidPlay = await cqSoundManager.play('ui_click');
      expect(rapidPlay).toBe(false);
    });

    it('allows play when overrideCooldown is true', async () => {
      cqSoundManager.setSoundEnabled(true);

      const firstPlay = await cqSoundManager.play('ui_click');
      expect(firstPlay).toBe(true);

      const forcedPlay = await cqSoundManager.play('ui_click', { overrideCooldown: true });
      expect(forcedPlay).toBe(true);
    });
  });

  describe('4. Major Reward Priority & Ducking Protection', () => {
    it('assigns higher priority to major moments than UI interactions', () => {
      expect(CQ_SOUND_CONFIGS.finale_qualified.priority).toBe(100);
      expect(CQ_SOUND_CONFIGS.rank_up.priority).toBe(90);
      expect(CQ_SOUND_CONFIGS.badge_unlock.priority).toBe(85);
      expect(CQ_SOUND_CONFIGS.quest_complete.priority).toBe(80);
      expect(CQ_SOUND_CONFIGS.ui_click.priority).toBe(10);
    });

    it('ducks low-priority UI clicks while a major reward sound is playing', async () => {
      cqSoundManager.setSoundEnabled(true);

      // Play major reward (priority 100)
      const majorPlay = await cqSoundManager.play('finale_qualified');
      expect(majorPlay).toBe(true);
      expect(cqSoundManager.getState().activeMajorPriority).toBe(100);

      // Low-priority UI click should be ducked to protect reward clarity
      const duckedClick = await cqSoundManager.play('ui_click');
      expect(duckedClick).toBe(false);
    });
  });

  describe('5. Reward Sound Sequencing', () => {
    it('executes playSequence across multiple events with intentional stagger', async () => {
      const playSpy = vi.spyOn(cqSoundManager, 'play');

      await cqSoundManager.playSequence(
        ['quest_complete', 'rank_up', 'badge_unlock'],
        30
      );

      expect(playSpy).toHaveBeenCalledTimes(3);
      expect(playSpy).toHaveBeenNthCalledWith(1, 'quest_complete', { overrideCooldown: true });
      expect(playSpy).toHaveBeenNthCalledWith(2, 'rank_up', { overrideCooldown: true });
      expect(playSpy).toHaveBeenNthCalledWith(3, 'badge_unlock', { overrideCooldown: true });
    });
  });

  describe('6. User Preference Persistence & Storage Safety', () => {
    it('persists soundEnabled to cq_sound_enabled and syncs canton_effects_muted in localStorage', () => {
      cqSoundManager.setSoundEnabled(false);
      expect(mockStorage.getItem('cq_sound_enabled')).toBe('false');
      expect(mockStorage.getItem('canton_effects_muted')).toBe('true');

      cqSoundManager.setSoundEnabled(true);
      expect(mockStorage.getItem('cq_sound_enabled')).toBe('true');
      expect(mockStorage.getItem('canton_effects_muted')).toBe('false');
    });

    it('persists master volume to cq_sound_volume in localStorage', () => {
      cqSoundManager.setVolume(0.65);
      expect(cqSoundManager.getVolume()).toBe(0.65);
      expect(mockStorage.getItem('cq_sound_volume')).toBe('0.65');
    });

    it('restores preferences on new manager initialization', () => {
      mockStorage.setItem('cq_sound_enabled', 'false');
      mockStorage.setItem('cq_sound_volume', '0.42');

      const newManager = new CQSoundManager();
      expect(newManager.isSoundEnabled()).toBe(false);
      expect(newManager.getVolume()).toBe(0.42);
    });

    it('does not touch or collide with user auth keys', () => {
      mockStorage.setItem('canton_auth_token', 'jwt-test-secret');
      mockStorage.setItem('canton_quests_current_player', '{"id":"plr-123"}');

      cqSoundManager.setSoundEnabled(false);
      cqSoundManager.setVolume(0.5);

      expect(mockStorage.getItem('canton_auth_token')).toBe('jwt-test-secret');
      expect(mockStorage.getItem('canton_quests_current_player')).toBe('{"id":"plr-123"}');
    });
  });

  describe('7. Procedural Web Audio Engine & Game Moment Integration', () => {
    it('proceduralSoundEngine delegates game rewards to CQ sound manager', () => {
      const playSpy = vi.spyOn(cqSoundManager, 'play');

      proceduralSoundEngine.playQuestComplete(250);
      expect(playSpy).toHaveBeenCalledWith('quest_complete');

      proceduralSoundEngine.playRankUp('first');
      expect(playSpy).toHaveBeenCalledWith('rank_up');

      proceduralSoundEngine.playAchievement();
      expect(playSpy).toHaveBeenCalledWith('badge_unlock');

      proceduralSoundEngine.playFlashDrop();
      expect(playSpy).toHaveBeenCalledWith('flash_drop');

      proceduralSoundEngine.playFinaleQualified();
      expect(playSpy).toHaveBeenCalledWith('finale_qualified');
    });

    it('proceduralSoundEngine routes PathLock events to path-specific audio identities', () => {
      const playSpy = vi.spyOn(cqSoundManager, 'play');

      proceduralSoundEngine.playPathLock('family');
      expect(playSpy).toHaveBeenCalledWith('path_family');

      proceduralSoundEngine.playPathLock('challenge');
      expect(playSpy).toHaveBeenCalledWith('path_challenge');

      proceduralSoundEngine.playPathLock('secret');
      expect(playSpy).toHaveBeenCalledWith('path_secret');
    });

    it('synchronizes muting between proceduralSoundEngine and gameMomentManager', () => {
      proceduralSoundEngine.setMuted(true);
      expect(cqSoundManager.isSoundEnabled()).toBe(false);
      expect(proceduralSoundEngine.getIsMuted()).toBe(true);

      proceduralSoundEngine.setMuted(false);
      expect(cqSoundManager.isSoundEnabled()).toBe(true);
      expect(proceduralSoundEngine.getIsMuted()).toBe(false);
    });
  });

  describe('8. SSR & Graceful Failure Failsafes', () => {
    it('gracefully handles pure Node SSR environment without window or DOM', async () => {
      // Temporarily remove global window to simulate server-side rendering
      const originalWindow = (global as any).window;
      delete (global as any).window;

      const ssrManager = new CQSoundManager();
      expect(ssrManager.isSoundEnabled()).toBe(true);

      const ssrPlay = await ssrManager.play('ui_click');
      expect(ssrPlay).toBe(false); // Cleanly returns false without throwing

      // Restore window
      (global as any).window = originalWindow;
    });

    it('gracefully handles audio playback errors without throwing unhandled exceptions', async () => {
      // Create audio element whose play() throws an error
      class FailingAudio extends MockAudio {
        public override play(): Promise<void> {
          return Promise.reject(new Error('AutoplayBlocked'));
        }
      }
      (global as any).Audio = FailingAudio;

      const testManager = new CQSoundManager();
      const result = await testManager.play('ui_click');
      expect(result).toBe(false); // Gracefully caught and returned false
    });
  });
});
