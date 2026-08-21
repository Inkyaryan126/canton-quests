/**
 * Canton Quests — Centralized Tactical Audio & Sound Manager
 *
 * Implements a high-performance, mobile-first audio engine for Canton Quests.
 * Features:
 * - Native browser HTML5 Audio pooling and Web Audio API integration
 * - Granular cooldown debouncing and spam protection
 * - Dynamic priority ducking (major rewards take precedence over UI clicks)
 * - Deterministic reward sound sequencing with stagger delays
 * - Persistent global sound and volume controls (localStorage)
 * - Safe server-side rendering (SSR) guards
 * - Mobile touch/pointer gesture audio unlock without console errors
 */

import {
  CQ_SOUND_CONFIGS,
  CQ_SOUND_MAP,
  CQSoundConfig,
  CQSoundEvent,
  CQSoundKey,
  resolveSoundConfig,
} from './cq-sound-map';

export interface PlaySoundOptions {
  volume?: number; // Override volume scale (0.0 to 1.0)
  overrideCooldown?: boolean;
  onEnded?: () => void;
}

export interface SoundManagerState {
  soundEnabled: boolean;
  volume: number; // 0.0 to 1.0
  activeMajorPriority: number; // Current active highest priority playing
}

type SoundListener = (state: SoundManagerState) => void;

const STORAGE_KEY_ENABLED = 'cq_sound_enabled';
const STORAGE_KEY_VOLUME = 'cq_sound_volume';
const LEGACY_STORAGE_KEY_MUTED = 'canton_effects_muted';

export class CQSoundManager {
  private soundEnabled: boolean = true;
  private volume: number = 0.85; // Global master volume
  private audioPool: Map<string, HTMLAudioElement[]> = new Map();
  private lastPlayedMap: Map<string, number> = new Map();
  private activeCountMap: Map<string, number> = new Map();
  private activeMajorPriority: number = 0;
  private priorityResetTimer: NodeJS.Timeout | null = null;
  private listeners: Set<SoundListener> = new Set();
  private isUnlocked: boolean = false;
  private audioContext: AudioContext | null = null;

  private get isClient(): boolean {
    return typeof window !== 'undefined';
  }

  constructor() {
    if (this.isClient) {
      this.initFromStorage();
      this.setupGestureUnlock();
    }
  }

  /**
   * Initializes preferences from localStorage safely.
   */
  public initFromStorage(): void {
    if (!this.isClient) return;

    try {
      // 1. Check cq_sound_enabled
      const storedEnabled = window.localStorage.getItem(STORAGE_KEY_ENABLED);
      if (storedEnabled !== null) {
        this.soundEnabled = storedEnabled === 'true';
      } else {
        // Fallback to legacy key if present
        const legacyMuted = window.localStorage.getItem(LEGACY_STORAGE_KEY_MUTED);
        if (legacyMuted !== null) {
          this.soundEnabled = legacyMuted !== 'true';
        }
      }

      // 2. Check cq_sound_volume
      const storedVolume = window.localStorage.getItem(STORAGE_KEY_VOLUME);
      if (storedVolume !== null) {
        const parsed = parseFloat(storedVolume);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }
    } catch {
      // Storage access failsafe (e.g. private mode restrictions)
    }
  }

  /**
   * Sets up one-time user gesture listeners to unlock browser audio contexts and elements.
   */
  private setupGestureUnlock() {
    if (this.isUnlocked || !this.isClient) return;

    const unlock = () => {
      this.unlockAudio();
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', unlock, { once: true, passive: true });
      window.addEventListener('touchstart', unlock, { once: true, passive: true });
      window.addEventListener('keydown', unlock, { once: true, passive: true });
    }
  }

  /**
   * Unlocks and initializes audio pipelines on user gesture.
   */
  public async unlockAudio(): Promise<void> {
    if (this.isUnlocked || !this.isClient) return;
    this.isUnlocked = true;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx && !this.audioContext) {
        this.audioContext = new AudioCtx();
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume().catch(() => {});
        }
      }
    } catch {
      // Ignore
    }

    // Preload critical sound assets asynchronously
    this.preloadCriticalSounds();
  }

  /**
   * Preloads high-frequency and critical sound assets.
   */
  public preloadCriticalSounds(): void {
    if (!this.isClient) return;

    Object.values(CQ_SOUND_CONFIGS)
      .filter((config) => config.preload)
      .forEach((config) => {
        this.getOrCreateAudioElement(config.src);
      });
  }

  /**
   * Retrieves or instantiates an HTMLAudioElement from the instance pool.
   */
  private getOrCreateAudioElement(src: string): HTMLAudioElement | null {
    if (!this.isClient) return null;

    let pool = this.audioPool.get(src);
    if (!pool) {
      pool = [];
      this.audioPool.set(src, pool);
    }

    // Find an idle element in the pool
    const idle = pool.find((audio) => audio.paused || audio.ended);
    if (idle) {
      return idle;
    }

    // Allow up to 3 pooled instances per asset
    if (pool.length < 3) {
      try {
        const audio = typeof Audio !== 'undefined' ? new Audio(src) : null;
        if (audio) {
          audio.preload = 'auto';
          pool.push(audio);
          return audio;
        }
        return null;
      } catch {
        return null;
      }
    }

    // Return the oldest element if maximum concurrency reached
    return pool[0] || null;
  }

  /**
   * Subscribe to sound manager preference updates.
   */
  public subscribe(listener: SoundListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(state);
      } catch (err) {
        console.error('[CQSoundManager] Listener error:', err);
      }
    });
  }

  public getState(): SoundManagerState {
    return {
      soundEnabled: this.soundEnabled,
      volume: this.volume,
      activeMajorPriority: this.activeMajorPriority,
    };
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;

    if (this.isClient) {
      try {
        window.localStorage.setItem(STORAGE_KEY_ENABLED, enabled.toString());
        // Sync legacy key
        window.localStorage.setItem(LEGACY_STORAGE_KEY_MUTED, (!enabled).toString());
      } catch {
        // Failsafe
      }
    }

    this.notify();
  }

  public toggleSound(): boolean {
    const next = !this.soundEnabled;
    this.setSoundEnabled(next);
    return next;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;

    if (this.isClient) {
      try {
        window.localStorage.setItem(STORAGE_KEY_VOLUME, clamped.toString());
      } catch {
        // Failsafe
      }
    }

    this.notify();
  }

  /**
   * Play a sound by event name or camelCase key.
   * Enforces spam debouncing, concurrency limits, and priority ducking.
   */
  public async play(
    identifier: CQSoundEvent | CQSoundKey,
    options?: PlaySoundOptions
  ): Promise<boolean> {
    if (!this.soundEnabled || !this.isClient) {
      return false;
    }

    const config = resolveSoundConfig(identifier);
    const now = Date.now();
    const lastPlayed = this.lastPlayedMap.get(config.src) || 0;

    // 1. Cooldown spam check
    if (!options?.overrideCooldown && now - lastPlayed < config.cooldownMs) {
      return false; // Suppressed by cooldown
    }

    // 2. Priority check: If a major reward (priority >= 75) is currently playing,
    // suppress low-priority UI clicks to prevent muddy stacking
    if (this.activeMajorPriority >= 75 && config.priority < 40) {
      return false; // Ducked for major reward clarity
    }

    // 3. Concurrency check: max 2 active instances of the same sound
    const activeCount = this.activeCountMap.get(config.src) || 0;
    if (activeCount >= 2) {
      return false;
    }

    const audio = this.getOrCreateAudioElement(config.src);
    if (!audio) {
      return false;
    }

    this.lastPlayedMap.set(config.src, now);
    this.activeCountMap.set(config.src, activeCount + 1);

    // Track major reward priority state
    if (config.priority >= 70) {
      this.activeMajorPriority = Math.max(this.activeMajorPriority, config.priority);
      if (this.priorityResetTimer) clearTimeout(this.priorityResetTimer);
      this.priorityResetTimer = setTimeout(() => {
        this.activeMajorPriority = 0;
        this.priorityResetTimer = null;
      }, 1200);
    }

    const targetVolume = (options?.volume ?? config.volume) * this.volume;
    audio.volume = Math.max(0, Math.min(1, targetVolume));
    audio.currentTime = 0;

    const cleanup = () => {
      const current = this.activeCountMap.get(config.src) || 1;
      this.activeCountMap.set(config.src, Math.max(0, current - 1));
      if (options?.onEnded) {
        try {
          options.onEnded();
        } catch {
          // Ignore
        }
      }
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;

    try {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      return true;
    } catch {
      cleanup();
      return false;
    }
  }

  /**
   * Explicit event helper matching the CQSoundEvent union.
   */
  public playEvent(event: CQSoundEvent, options?: PlaySoundOptions): Promise<boolean> {
    return this.play(event, options);
  }

  /**
   * Plays an intentional sequence of reward sounds staggered over time.
   * Ensures major moments (quest complete -> rank up -> badge unlock -> chain unlock)
   * feel orchestrated rather than all exploding simultaneously.
   */
  public async playSequence(
    events: Array<CQSoundEvent | CQSoundKey>,
    staggerMs: number = 400
  ): Promise<void> {
    if (!this.soundEnabled || events.length === 0) return;

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      await this.play(evt, { overrideCooldown: true });
      if (i < events.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, staggerMs));
      }
    }
  }

  /**
   * Reset internal maps (useful for unit test teardown).
   */
  public resetForTesting(): void {
    this.lastPlayedMap.clear();
    this.activeCountMap.clear();
    this.activeMajorPriority = 0;
    if (this.priorityResetTimer) {
      clearTimeout(this.priorityResetTimer);
      this.priorityResetTimer = null;
    }
    this.audioPool.clear();
  }
}

// Global Singleton Instance
export const cqSoundManager = new CQSoundManager();
