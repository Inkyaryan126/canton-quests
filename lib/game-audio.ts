/**
 * Canton Quests — Procedural Web Audio HUD Sound Synthesizer
 *
 * Lightweight, zero-dependency, procedural audio engine for futuristic game moments.
 * Works natively in all modern browsers without downloading external sound files.
 * Handles audio context lifecycle, user-gesture unlock, muting, and failsafe fallbacks.
 */

import { StartingPath } from './types';
import { RankTier } from './game-effects';

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isUnlocked: boolean = false;

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
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
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
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * City Scan: Radar ping + futuristic frequency sweep
   */
  public playCityScan() {
    if (this.isMuted) return;
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
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.55);

      // Faint secondary harmonic
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1040, now + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(2200, now + 0.4);

      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.linearRampToValueAtTime(0.06, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.1);
      osc2.stop(now + 0.5);
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Path Lock: Deep resonant lock impact + path personality chord
   */
  public playPathLock(path: StartingPath) {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Sub-bass thump
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(45, now + 0.4);

      subGain.gain.setValueAtTime(0.25, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.65);

      // 2. Path-specific harmonic frequency
      const chord = path === 'family'
        ? [440, 554.37, 659.25, 880] // A Major (warm, bright, adventurous)
        : path === 'challenge'
        ? [330, 493.88, 659.25, 987.77] // E Power fifths (sharp, driving, energetic)
        : [293.66, 349.23, 440, 587.33]; // D Minor (mysterious, ancient, cryptic)

      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = path === 'challenge' ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + 0.08 * idx);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(path === 'challenge' ? 2500 : 1800, now);

        gain.gain.setValueAtTime(0.001, now + 0.08 * idx);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.08 * idx + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08 * idx + 0.9);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + 0.08 * idx);
        osc.stop(now + 0.08 * idx + 0.95);
      });
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Quest Complete: Verification confirmation + ascending XP sparkle chime
   */
  public playQuestComplete(xpAmount: number) {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Initial confirmation pop
      const pop = ctx.createOscillator();
      const popGain = ctx.createGain();
      pop.type = 'sine';
      pop.frequency.setValueAtTime(320, now);
      pop.frequency.exponentialRampToValueAtTime(640, now + 0.12);

      popGain.gain.setValueAtTime(0.18, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      pop.connect(popGain);
      popGain.connect(ctx.destination);
      pop.start(now);
      pop.stop(now + 0.28);

      // Ascending XP sparkle arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const noteOsc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        noteOsc.type = 'sine';
        noteOsc.frequency.setValueAtTime(freq, now + 0.15 + idx * 0.08);

        noteGain.gain.setValueAtTime(0.001, now + 0.15 + idx * 0.08);
        noteGain.gain.linearRampToValueAtTime(0.09, now + 0.15 + idx * 0.08 + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15 + idx * 0.08 + 0.6);

        noteOsc.connect(noteGain);
        noteGain.connect(ctx.destination);

        noteOsc.start(now + 0.15 + idx * 0.08);
        noteOsc.stop(now + 0.15 + idx * 0.08 + 0.65);
      });
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Rank Up: Ascending fanfare synth with tier intensity
   */
  public playRankUp(tier: RankTier = 'normal') {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Tier adjustments
      const baseFreq = tier === 'first' ? 440 : tier === 'top3' ? 392 : 349.23;
      const multipliers = [1, 1.25, 1.5, 2, 2.5]; // Major triad progression

      multipliers.forEach((mult, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = tier === 'first' ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(baseFreq * mult, now + idx * 0.1);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(tier === 'first' ? 3000 : 2000, now);

        const vol = tier === 'first' ? 0.12 : 0.08;
        gain.gain.setValueAtTime(0.001, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(vol, now + idx * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.85);
      });

      // Sub drop impact for top tiers
      if (tier === 'top3' || tier === 'first') {
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(120, now + 0.4);
        sub.frequency.exponentialRampToValueAtTime(40, now + 0.9);

        subGain.gain.setValueAtTime(0.2, now + 0.4);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

        sub.connect(subGain);
        subGain.connect(ctx.destination);
        sub.start(now + 0.4);
        sub.stop(now + 1.15);
      }
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Achievement: Metallic resonant unlock chime
   */
  public playAchievement() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [587.33, 739.99, 880, 1174.66, 1760]; // D, F#, A, D, A
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.001, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.07, now + idx * 0.06 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 1.25);
      });
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Flash Drop: Urgent tactical alert pulse
   */
  public playFlashDrop() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // 3 rapid pulses
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now + i * 0.12);
        osc.frequency.setValueAtTime(440, now + i * 0.12 + 0.06);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, now);

        gain.gain.setValueAtTime(0.08, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.11);
      }
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Finale Qualified: Rare prestigious celestial chord
   */
  public playFinaleQualified() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Deep gong resonance + shimmer
      const freqs = [110, 220, 329.63, 440, 554.37, 659.25, 880, 1318.51];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = idx < 2 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, now);

        gain.gain.setValueAtTime(0.001, now + idx * 0.04);
        gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.04 + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 2.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 2.6);
      });
    } catch {
      // Audio failsafe
    }
  }
}

export const proceduralSoundEngine = new ProceduralSoundEngine();
