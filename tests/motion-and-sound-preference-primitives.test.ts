import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { prefersReducedMotion, confirmHaptic } from '../lib/motion';
import { cqSoundManager } from '../lib/audio/cq-sound-manager';
import { getSoundPreference, subscribeSoundPreference } from '../lib/audio/sound-preference';

function stubMatchMedia(matches: boolean) {
  const mediaQueryList = {
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('window', { matchMedia: vi.fn(() => mediaQueryList) });
  return mediaQueryList;
}

describe('lib/motion — field-equipment motion primitives', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats an unavailable window as reduced motion (SSR-safe default)', () => {
    expect(prefersReducedMotion()).toBe(true);
  });

  it('reads the live OS preference from matchMedia when available', () => {
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);

    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('confirmHaptic never fires unless explicitly enabled', () => {
    stubMatchMedia(false);
    vi.stubGlobal('navigator', { vibrate: vi.fn(() => true) });
    expect(confirmHaptic()).toBe(false);
    expect(confirmHaptic({ enabled: false })).toBe(false);
  });

  it('confirmHaptic respects reduced motion even when enabled', () => {
    stubMatchMedia(true);
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(confirmHaptic({ enabled: true })).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('confirmHaptic is feature-detected and never throws when vibrate is absent', () => {
    stubMatchMedia(false);
    vi.stubGlobal('navigator', {});
    expect(() => confirmHaptic({ enabled: true })).not.toThrow();
    expect(confirmHaptic({ enabled: true })).toBe(false);
  });

  it('confirmHaptic pulses once when enabled, motion is allowed, and vibrate exists', () => {
    stubMatchMedia(false);
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(confirmHaptic({ enabled: true })).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(12);
  });

  it('never lets a throwing vibration API interrupt the caller', () => {
    stubMatchMedia(false);
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('denied by browser policy');
      },
    });
    expect(() => confirmHaptic({ enabled: true })).not.toThrow();
    expect(confirmHaptic({ enabled: true })).toBe(false);
  });

  it('app/globals.css collapses every cq-motion duration token under prefers-reduced-motion', () => {
    const css = fs.readFileSync(path.join(__dirname, '../app/globals.css'), 'utf8');
    const reducedBlockMatch = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.cq-motion-scope,\s*\.cq-transition-reveal,\s*\.cq-transition-settle \{([\s\S]*?)\}/
    );
    expect(reducedBlockMatch).not.toBeNull();
    expect(reducedBlockMatch![1]).toContain('--cq-motion-press: var(--cq-motion-instant)');
    expect(reducedBlockMatch![1]).toContain('--cq-motion-settle: var(--cq-motion-instant)');
    expect(reducedBlockMatch![1]).toContain('--cq-motion-reveal: var(--cq-motion-instant)');
  });
});

describe('lib/audio/sound-preference — shared global sound preference', () => {
  beforeEach(() => {
    cqSoundManager.setSoundEnabled(true);
  });

  it('getSoundPreference mirrors cqSoundManager, the single source of truth', () => {
    expect(getSoundPreference()).toBe(cqSoundManager.isSoundEnabled());

    cqSoundManager.setSoundEnabled(false);
    expect(getSoundPreference()).toBe(false);

    cqSoundManager.setSoundEnabled(true);
    expect(getSoundPreference()).toBe(true);
  });

  it('subscribeSoundPreference notifies on every preference change and unsubscribes cleanly', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeSoundPreference(onChange);

    // subscribe() itself replays the current state once, per cqSoundManager's contract.
    expect(onChange).toHaveBeenCalledTimes(1);

    cqSoundManager.toggleSound();
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    cqSoundManager.toggleSound();
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
