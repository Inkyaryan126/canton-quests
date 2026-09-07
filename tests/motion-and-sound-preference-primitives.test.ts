import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function motionBrowser(reduced = false) {
  const changes = new EventTarget();
  const query = Object.assign(changes, { matches: reduced });
  vi.stubGlobal('window', { matchMedia: () => query });
  return query;
}

describe('shared motion preference', () => {
  it('defaults to reduced motion during SSR or without matchMedia', async () => {
    vi.stubGlobal('window', undefined);
    const motion = await import('../lib/motion/reduced-motion');
    expect(motion.prefersReducedMotion()).toBe(true);
    vi.stubGlobal('window', {});
    expect(motion.prefersReducedMotion()).toBe(true);
  });

  it('tracks live OS changes and removes the listener on unsubscribe', async () => {
    const query = motionBrowser();
    const motion = await import('../lib/motion/reduced-motion');
    const observed: boolean[] = [];
    const unsubscribe = motion.subscribeReducedMotion(() => observed.push(motion.prefersReducedMotion()));
    expect(motion.prefersReducedMotion()).toBe(false);
    query.matches = true;
    query.dispatchEvent(new Event('change'));
    expect(observed).toEqual([true]);
    unsubscribe();
    query.matches = false;
    query.dispatchEvent(new Event('change'));
    expect(observed).toEqual([true]);
  });

  it('supports older media query listeners and their cleanup', async () => {
    let listener: (() => void) | undefined;
    const query = {
      matches: false,
      addListener: (next: () => void) => { listener = next; },
      removeListener: (next: () => void) => { if (listener === next) listener = undefined; },
    };
    vi.stubGlobal('window', { matchMedia: () => query });
    const motion = await import('../lib/motion/reduced-motion');
    const observed: boolean[] = [];
    const unsubscribe = motion.subscribeReducedMotion(() => observed.push(motion.prefersReducedMotion()));
    query.matches = true;
    listener?.();
    expect(observed).toEqual([true]);
    unsubscribe();
    expect(listener).toBeUndefined();
  });
});

describe('optional confirmation haptics', () => {
  it('requires explicit opt-in, respects reduced motion, and limits repeated taps', async () => {
    const query = motionBrowser();
    const pulses: number[] = [];
    vi.stubGlobal('navigator', { vibrate: (ms: number) => { pulses.push(ms); return true; } });
    const { confirmHaptic } = await import('../lib/motion/haptics');
    expect(confirmHaptic()).toBe(false);
    query.matches = true;
    expect(confirmHaptic(true)).toBe(false);
    query.matches = false;
    expect(confirmHaptic(true)).toBe(true);
    expect(confirmHaptic(true)).toBe(false);
    expect(pulses).toHaveLength(1);
    expect(pulses[0]).toBeGreaterThan(0);
    expect(pulses[0]).toBeLessThanOrEqual(30);
  });

  it('returns false without interrupting the caller when unavailable, denied, or throwing', async () => {
    motionBrowser();
    const { confirmHaptic } = await import('../lib/motion/haptics');
    vi.stubGlobal('navigator', undefined);
    expect(confirmHaptic(true)).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(confirmHaptic(true)).toBe(false);
    vi.stubGlobal('navigator', { vibrate: () => false });
    expect(confirmHaptic(true)).toBe(false);
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('NotAllowedError'); } });
    expect(confirmHaptic(true)).toBe(false);
  });

  it('allows a later confirmation but never pulses in a hidden tab', async () => {
    motionBrowser();
    const pulses: number[] = [];
    vi.stubGlobal('navigator', { vibrate: (ms: number) => { pulses.push(ms); return true; } });
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { confirmHaptic } = await import('../lib/motion/haptics');
    expect(confirmHaptic(true)).toBe(false);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    expect(confirmHaptic(true)).toBe(true);
    now.mockReturnValue(2000);
    expect(confirmHaptic(true)).toBe(true);
    expect(pulses).toHaveLength(2);
  });
});

describe('real sound toggle server rendering', () => {
  it('keeps hydration markup stable when the browser preference differs from the server default', async () => {
    vi.stubGlobal('window', undefined);
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { default: SoundToggleControl } = await import('../components/game-effects/SoundToggleControl');
    const { cqSoundManager } = await import('../lib/audio/cq-sound-manager');
    const serverMarkup = renderToString(createElement(SoundToggleControl));
    cqSoundManager.setSoundEnabled(false);
    // React uses the same server snapshot before the client's store subscription takes over.
    expect(renderToString(createElement(SoundToggleControl))).toBe(serverMarkup);
    expect(serverMarkup).toContain('aria-pressed="true"');
  });
});
