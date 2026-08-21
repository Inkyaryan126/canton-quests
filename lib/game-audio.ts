/**
 * Canton Quests — Procedural & Tactical Web Audio Synthesizer
 *
 * Coordinates procedural Web Audio HUD frequency sweeps (radar pings, sub-bass harmonics)
 * and delegates high-impact game moments to the centralized CQ Sound Manager (`lib/audio/`).
 * Handles audio context lifecycle, user-gesture unlock, muting, and failsafe fallbacks.
 */

import { StartingPath } from './types';
import { RankTier } from './game-effects';
import { cqSoundManager } from './audio';

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('canton_effects_muted');
        this.isMuted = stored === 'true';
      } catch {
        // Fallback
      }

      // Unlock on first interaction
      const unlock = () => {
        this.getAudioContext();
        cqSoundManager.unlockAudio();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true, passive: true });
      window.addEventListener('touchstart', unlock, { once: true, passive: true });
      window.addEventListener('keydown', unlock, { once: true, passive: true });
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } catch {
        return null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    cqSoundManager.setSoundEnabled(!muted);
  }

  public getIsMuted(): boolean {
    return this.isMuted || !cqSoundManager.isSoundEnabled();
  }

  /**
   * City Scan: Radar ping + futuristic frequency sweep + asset playback
   */
  public playCityScan() {
    if (this.getIsMuted()) return;

    // Trigger centralized CQ Sound asset
    cqSoundManager.play('scan');

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Ping oscillator
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.4);
      filter.Q.setValueAtTime(4, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.35);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Path Lock: Deep resonant lock impact + path personality chord
   */
  public playPathLock(path: StartingPath) {
    if (this.getIsMuted()) return;

    const pathEvent =
      path === 'challenge'
        ? 'path_challenge'
        : path === 'secret'
        ? 'path_secret'
        : 'path_family';

    // Play high-fidelity path audio asset
    cqSoundManager.play(pathEvent);

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Sub-bass thump
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(45, now + 0.4);

      subGain.gain.setValueAtTime(0.2, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.65);
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Quest Complete: Verification confirmation + ascending XP sparkle chime
   */
  public playQuestComplete(xpAmount: number) {
    if (this.getIsMuted()) return;

    // Trigger high-fidelity CQ asset
    cqSoundManager.play('quest_complete');
  }

  /**
   * Rank Up: Ascending fanfare synth with tier intensity
   */
  public playRankUp(tier: RankTier = 'normal') {
    if (this.getIsMuted()) return;

    // Trigger high-fidelity CQ asset
    cqSoundManager.play('rank_up');
  }

  /**
   * Achievement: Metallic resonant unlock chime
   */
  public playAchievement() {
    if (this.getIsMuted()) return;

    // Trigger high-fidelity CQ asset
    cqSoundManager.play('badge_unlock');
  }

  /**
   * Flash Drop: Urgent tactical alert pulse
   */
  public playFlashDrop() {
    if (this.getIsMuted()) return;

    // Trigger high-fidelity CQ asset
    cqSoundManager.play('flash_drop');
  }

  /**
   * Finale Qualified: Rare prestigious celestial chord
   */
  public playFinaleQualified() {
    if (this.getIsMuted()) return;

    // Trigger high-fidelity CQ asset
    cqSoundManager.play('finale_qualified');
  }
}

export const proceduralSoundEngine = new ProceduralSoundEngine();
