/**
 * Canton Quests — Opening Video / Commander Transmission progression fix.
 *
 * ROOT CAUSE: GameMomentManager.scheduleAutoDismiss() unconditionally set a
 * setTimeout (8000ms / 4000ms reduced-motion default for
 * 'commander-transmission') on EVERY moment, including ones playing a real
 * video of unknown/longer length. The timer started the instant the moment
 * was enqueued — completely independent of whether the video had even
 * started (browsers require a user gesture; no autoPlay was ever set), was
 * paused, buffering, or mid-playback. By the time a player pressed the
 * native Play control, part of that fixed window was already gone, so the
 * background timer fired and force-advanced the game mid-video — exactly
 * the "plays a bit, then jumps ahead" symptom reported for the Founder's
 * Cipher "Cold Open" opening video (id 1, trigger 'cipher_cold_open').
 *
 * FIX: commander-transmission moments now default `autoDismiss: false`
 * (see getDefaultAutoDismiss), so scheduleAutoDismiss never sets a timer
 * for this type — regardless of how long the fake clock runs. Progression
 * happens only via an authoritative event: the video's real `onEnded`
 * (CommanderMedia's onVideoEnded, wired to CommanderTransmissionEffect's
 * handleContinue) or the player's explicit Skip/Continue click — both
 * routed through the same handleContinue, guarded by a ref so a
 * near-simultaneous onEnded + click never double-advances.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { gameMomentManager, showGameMoment } from '../lib/game-effects';
import { computeUnlockedCommanderVideoIds } from '../lib/commander-video-unlock';
import { COMMANDER_TRANSMISSIONS, toGameplayTransmission } from '../lib/commander-transmissions';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('GameMomentManager — commander-transmission never auto-dismisses on a timer', () => {
  beforeEach(() => {
    gameMomentManager.skipAll();
    gameMomentManager.setReducedMotion(false);
  });

  afterEach(() => {
    gameMomentManager.skipAll();
    vi.useRealTimers();
  });

  it('does not advance after an arbitrary timeout, even one much longer than the old 8000ms default', () => {
    vi.useFakeTimers();
    const coldOpen = COMMANDER_TRANSMISSIONS.find((t) => t.id === 1)!;
    const id = showGameMoment({
      type: 'commander-transmission',
      trigger: 'cipher_cold_open',
      transmission: toGameplayTransmission(coldOpen),
    });

    // Advance far past the old hardcoded 8000ms / 4000ms window — a long
    // real video, a paused player, buffering, or a slow user are all
    // plausible reasons this much time could pass before completion.
    vi.advanceTimersByTime(120_000);

    const state = gameMomentManager.getState();
    expect(state.currentMoment?.id).toBe(id);
    expect(state.currentMoment?.type).toBe('commander-transmission');
  });

  it('does not advance even with reduced motion enabled (shorter default duration)', () => {
    vi.useFakeTimers();
    gameMomentManager.setReducedMotion(true);
    const coldOpen = COMMANDER_TRANSMISSIONS.find((t) => t.id === 1)!;
    const id = showGameMoment({
      type: 'commander-transmission',
      trigger: 'cipher_cold_open',
      transmission: toGameplayTransmission(coldOpen),
    });

    vi.advanceTimersByTime(60_000);

    expect(gameMomentManager.getState().currentMoment?.id).toBe(id);
  });

  it('an explicit caller-supplied durationMs is also ignored for this type — duration alone can never drive completion', () => {
    vi.useFakeTimers();
    const id = showGameMoment({
      type: 'commander-transmission',
      trigger: 'cipher_welcome',
      transmission: toGameplayTransmission(COMMANDER_TRANSMISSIONS.find((t) => t.id === 2)!),
      durationMs: 500, // even a short explicit duration must not force-advance
    });

    vi.advanceTimersByTime(10_000);

    expect(gameMomentManager.getState().currentMoment?.id).toBe(id);
  });

  it('only an explicit dismissCurrent() call (Skip/Continue or onEnded) advances a commander-transmission moment', () => {
    vi.useFakeTimers();
    const id = showGameMoment({
      type: 'commander-transmission',
      trigger: 'cipher_cold_open',
      transmission: toGameplayTransmission(COMMANDER_TRANSMISSIONS.find((t) => t.id === 1)!),
    });
    expect(gameMomentManager.getState().currentMoment?.id).toBe(id);

    vi.advanceTimersByTime(30_000);
    expect(gameMomentManager.getState().currentMoment?.id).toBe(id); // still there

    gameMomentManager.dismissCurrent(); // the authoritative event
    expect(gameMomentManager.getState().currentMoment).toBeNull();
  });

  it('a single dismissCurrent() call advances by exactly one moment — proves why the component-level double-fire guard matters', () => {
    showGameMoment({ type: 'commander-transmission', trigger: 'cipher_cold_open', transmission: toGameplayTransmission(COMMANDER_TRANSMISSIONS.find((t) => t.id === 1)!) });
    showGameMoment({ type: 'commander-transmission', trigger: 'cipher_welcome', transmission: toGameplayTransmission(COMMANDER_TRANSMISSIONS.find((t) => t.id === 2)!) });

    gameMomentManager.dismissCurrent();
    const afterOne = gameMomentManager.getState().currentMoment;
    expect(afterOne).not.toBeNull();
    expect((afterOne as any)?.trigger).toBe('cipher_welcome');

    // A second, spurious dismissCurrent() (what a double-fired onEnded
    // would cause without the ref guard in CommanderTransmissionEffect)
    // would consume the SECOND moment too — exactly the "double-advance"
    // bug the ref guard exists to prevent.
    gameMomentManager.dismissCurrent();
    expect(gameMomentManager.getState().currentMoment).toBeNull();
  });

  it('non-video moment types are unaffected — they still auto-dismiss on their timer as before', () => {
    vi.useFakeTimers();
    const id = showGameMoment({ type: 'city-scan', targetCount: 5 });
    expect(gameMomentManager.getState().currentMoment?.id).toBe(id);

    vi.advanceTimersByTime(5000); // well past city-scan's ~950ms default
    expect(gameMomentManager.getState().currentMoment?.id).not.toBe(id);
  });

  it('a caller can still explicitly opt a commander-transmission moment INTO timer-based dismissal via autoDismiss: true, proving the default is a default, not a hardcoded ban', () => {
    vi.useFakeTimers();
    const id = showGameMoment({
      type: 'commander-transmission',
      trigger: 'cipher_welcome',
      transmission: toGameplayTransmission(COMMANDER_TRANSMISSIONS.find((t) => t.id === 2)!),
      autoDismiss: true,
      durationMs: 1000,
    });
    expect(gameMomentManager.getState().currentMoment?.id).toBe(id);
    vi.advanceTimersByTime(1500);
    expect(gameMomentManager.getState().currentMoment?.id).not.toBe(id);
  });
});

describe('Video element wiring — pause/buffer/seek/autoplay-block never advance; only onEnded and explicit Skip do', () => {
  const mediaSource = readSource('components/commander/CommanderMedia.tsx');
  const effectSource = readSource('components/game-effects/CommanderTransmissionEffect.tsx');

  it('CommanderMedia wires the video element\'s onEnded to the onVideoEnded callback prop', () => {
    expect(mediaSource).toMatch(/onEnded=\{onVideoEnded\}/);
  });

  it('CommanderMedia never attempts autoplay — the browser always shows a real Play control, and no phase timer can start before the player acts', () => {
    // A <video ... autoPlay ...> attribute would risk the browser silently
    // blocking playback while an (now-removed) invisible timer kept
    // running. No autoPlay is set at all, so playback only ever begins
    // from an explicit user gesture on the native controls.
    const videoBlockMatch = mediaSource.match(/<video[\s\S]*?<\/video>/);
    expect(videoBlockMatch).not.toBeNull();
    expect(videoBlockMatch![0]).not.toMatch(/autoPlay/);
    expect(videoBlockMatch![0]).toContain('controls');
  });

  it('CommanderMedia never wires onPause/onWaiting/onSeeking/onTimeUpdate to any advance/dismiss logic', () => {
    expect(mediaSource).not.toMatch(/onPause=/);
    expect(mediaSource).not.toMatch(/onWaiting=/);
    expect(mediaSource).not.toMatch(/onSeeking=/);
    expect(mediaSource).not.toMatch(/onTimeUpdate=/);
  });

  it('CommanderTransmissionEffect passes handleContinue as CommanderMedia\'s onVideoEnded — video completion and the Skip CTA share one code path', () => {
    expect(effectSource).toMatch(/onVideoEnded=\{handleContinue\}/);
    expect(effectSource).toMatch(/onClick=\{handleContinue\}/);
  });

  it('handleContinue is guarded against firing more than once per moment (onEnded + a near-simultaneous click cannot double-advance)', () => {
    expect(effectSource).toMatch(/hasAdvancedRef/);
    expect(effectSource).toMatch(/if \(hasAdvancedRef\.current\) return;/);
    expect(effectSource).toMatch(/hasAdvancedRef\.current = true;/);
    // The guard resets per moment (keyed off moment.id), not just once ever.
    expect(effectSource).toMatch(/\[moment\.id\]/);
  });

  it('GameMomentManager no longer imports/uses a fixed commander-transmission duration to drive dismissal', () => {
    const gameEffectsSource = readSource('lib/game-effects.ts');
    expect(gameEffectsSource).toMatch(/getDefaultAutoDismiss/);
    expect(gameEffectsSource).toMatch(/type !== 'commander-transmission'/);
    expect(gameEffectsSource).toMatch(/if \(moment\.autoDismiss === false\) return;/);
  });
});

describe('The opening cinematic (Cold Open) is revealed for archive visibility immediately on Mission entry', () => {
  it('id 1 (Cold Open, trigger cipher_cold_open) unlocks as soon as the player has entered the Mission, before any other milestone', () => {
    const unlocked = computeUnlockedCommanderVideoIds({
      hasEntered: true,
      isProfileComplete: false,
      hasXp: false,
      hasDrawingEntries: false,
      hasQuestActivity: false,
    });
    expect(unlocked.has(1)).toBe(true);
    const coldOpen = COMMANDER_TRANSMISSIONS.find((t) => t.trigger === 'cipher_cold_open');
    expect(coldOpen?.id).toBe(1);
  });

  it('id 1 is NOT unlocked before the player has entered the Mission at all', () => {
    const unlocked = computeUnlockedCommanderVideoIds({
      hasEntered: false,
      isProfileComplete: false,
      hasXp: false,
      hasDrawingEntries: false,
      hasQuestActivity: false,
    });
    expect(unlocked.has(1)).toBe(false);
  });
});
