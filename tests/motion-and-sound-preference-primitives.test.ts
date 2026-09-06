import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import postcss from 'postcss';
import SoundToggleControl from '../components/game-effects/SoundToggleControl';
import { cqSoundManager } from '../lib/audio';
import { getSoundPreference, subscribeSoundPreference } from '../lib/audio/sound-preference';
import { prefersReducedMotion, confirmHaptic } from '../lib/motion';

afterEach(() => {
  cqSoundManager.setSoundEnabled(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shared experience primitives', () => {
  it('reads and subscribes to the existing audio singleton, including unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSoundPreference(listener);
    listener.mockClear();
    cqSoundManager.setSoundEnabled(false);
    expect(getSoundPreference()).toBe(false);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    cqSoundManager.setSoundEnabled(true);
    expect(getSoundPreference()).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('safely disables optional motion and haptics on the server', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('navigator', undefined);
    expect(prefersReducedMotion()).toBe(true);
    expect(confirmHaptic({ enabled: true })).toBe(false);
  });

  it('honors live reduced-motion changes before every confirmation', () => {
    let reduced = false;
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) });
    vi.stubGlobal('navigator', { vibrate });
    expect(prefersReducedMotion()).toBe(false);
    expect(confirmHaptic({ enabled: true })).toBe(true);
    reduced = true;
    expect(prefersReducedMotion()).toBe(true);
    expect(confirmHaptic({ enabled: true })).toBe(false);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('requires opt-in and tolerates unsupported, denied, and throwing vibration APIs', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(confirmHaptic()).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', {});
    expect(confirmHaptic({ enabled: true })).toBe(false);
    vi.stubGlobal('navigator', { vibrate: () => false });
    expect(confirmHaptic({ enabled: true })).toBe(false);
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('Denied'); } });
    expect(confirmHaptic({ enabled: true })).toBe(false);
  });

  it('fails closed when the motion preference API is unavailable', () => {
    vi.stubGlobal('window', {});
    expect(prefersReducedMotion()).toBe(true);
  });

  it('integrates shared preference and motion styles into the real sound toggle', () => {
    const toggle = readFileSync('components/game-effects/SoundToggleControl.tsx', 'utf8');
    expect(toggle).toContain('useSoundPreference()');
    expect(toggle).toContain("motion['cq-motion-control']");
    expect(toggle).toContain('confirmHaptic(');
    expect(toggle).not.toContain('useState');
  });

  it('renders the real toggle with a stable server snapshot even when browser preference differs', () => {
    cqSoundManager.setSoundEnabled(false);
    const html = renderToString(createElement(SoundToggleControl, { soundEnabled: false }));
    expect(html).toContain('Mute Canton Quests sound effects');
    expect(html).toContain('SOUND ON');
    expect(getSoundPreference()).toBe(false);
  });

  it('resolves every shared CSS duration to zero under reduced motion', () => {
    const css = postcss.parse(readFileSync('lib/motion/primitives.module.css', 'utf8'));
    const values = (reduced: boolean) => {
      const declarations: Record<string, string> = {};
      css.walkDecls(decl => {
        const parent = decl.parent?.parent;
        if (parent?.type === 'atrule') {
          if (!reduced || (parent as postcss.AtRule).params !== '(prefers-reduced-motion: reduce)') return;
        }
        declarations[decl.prop] = decl.value;
      });
      const resolve = (value: string): string => value.startsWith('var(')
        ? resolve(declarations[value.slice(4, -1)]) : value;
      return { declarations, resolve };
    };
    const normal = values(false);
    expect(normal.resolve(normal.declarations['transition-duration'])).toBe('100ms');
    const reduced = values(true);
    for (const token of ['press', 'settle', 'reveal']) {
      expect(reduced.resolve(reduced.declarations[`--cq-motion-${token}`])).toBe('0ms');
    }
    expect(reduced.resolve(reduced.declarations['transition-duration'])).toBe('0ms');
    expect(reduced.declarations.animation).toBe('none');
  });
});
