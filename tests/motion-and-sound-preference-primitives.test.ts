import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { prefersReducedMotion, confirmHaptic, useReducedMotion } from '../lib/motion';
import {
  getSoundPreference,
  subscribeSoundPreference,
  useSoundPreference,
} from '../lib/audio/sound-preference';
import { cqSoundManager } from '../lib/audio/cq-sound-manager';

describe('Phase 2 — Motion and Sound Preference Primitives', () => {
  describe('lib/motion Primitives', () => {
    beforeEach(() => {
      vi.unstubAllGlobals();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('prefersReducedMotion defaults safely to true in SSR / non-browser environments', () => {
      vi.stubGlobal('window', undefined);
      expect(prefersReducedMotion()).toBe(true);
    });

    it('prefersReducedMotion reflects OS preference via matchMedia', () => {
      vi.stubGlobal('window', {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      });
      expect(prefersReducedMotion()).toBe(true);

      vi.stubGlobal('window', {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      });
      expect(prefersReducedMotion()).toBe(false);
    });

    it('exports useReducedMotion hook function', () => {
      expect(typeof useReducedMotion).toBe('function');
    });

    it('confirmHaptic returns false when disabled', () => {
      expect(confirmHaptic({ enabled: false })).toBe(false);
    });

    it('confirmHaptic returns false under reduced motion', () => {
      vi.stubGlobal('window', {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      });
      vi.stubGlobal('navigator', {
        vibrate: vi.fn().mockReturnValue(true),
      });
      expect(confirmHaptic({ enabled: true })).toBe(false);
    });

    it('confirmHaptic triggers navigator.vibrate when enabled and motion allowed', () => {
      vi.stubGlobal('window', {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      });
      const vibrateMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal('navigator', {
        vibrate: vibrateMock,
      });

      const result = confirmHaptic({ enabled: true });
      expect(result).toBe(true);
      expect(vibrateMock).toHaveBeenCalledWith(12);
    });

    it('confirmHaptic handles missing navigator.vibrate or vibration errors safely', () => {
      vi.stubGlobal('window', {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      });
      vi.stubGlobal('navigator', {});
      expect(confirmHaptic({ enabled: true })).toBe(false);

      vi.stubGlobal('navigator', {
        vibrate: vi.fn().mockImplementation(() => {
          throw new Error('Vibration permission denied');
        }),
      });
      expect(confirmHaptic({ enabled: true })).toBe(false);
    });
  });

  describe('lib/audio Sound Preference Store Sync', () => {
    afterEach(() => {
      cqSoundManager.setSoundEnabled(true);
    });

    it('getSoundPreference reflects cqSoundManager state', () => {
      cqSoundManager.setSoundEnabled(true);
      expect(getSoundPreference()).toBe(true);

      cqSoundManager.setSoundEnabled(false);
      expect(getSoundPreference()).toBe(false);

      cqSoundManager.setSoundEnabled(true);
      expect(getSoundPreference()).toBe(true);
    });

    it('subscribeSoundPreference notifies listeners on sound toggle', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeSoundPreference(listener);

      cqSoundManager.setSoundEnabled(false);
      expect(listener).toHaveBeenCalled();

      listener.mockClear();
      unsubscribe();
      cqSoundManager.setSoundEnabled(true);
      expect(listener).not.toHaveBeenCalled();
    });

    it('exports useSoundPreference hook function', () => {
      expect(typeof useSoundPreference).toBe('function');
    });
  });

  describe('CSS Motion Tokens & Reduced-Motion Contracts in app/globals.css', () => {
    const cssPath = join(process.cwd(), 'app/globals.css');
    const cssContent = readFileSync(cssPath, 'utf8');

    it('defines the canonical Phase 2 motion tokens in CSS', () => {
      expect(cssContent).toContain('--cq-motion-instant: 0ms;');
      expect(cssContent).toContain('--cq-motion-press: 100ms;');
      expect(cssContent).toContain('--cq-motion-settle: 180ms;');
      expect(cssContent).toContain('--cq-motion-reveal: 280ms;');
      expect(cssContent).toContain('--cq-motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);');
      expect(cssContent).toContain('--cq-motion-ease-enter: cubic-bezier(0, 0, 0.2, 1);');
      expect(cssContent).toContain('--cq-motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);');
    });

    it('defines .cq-motion-scope, .cq-transition-reveal, and .cq-transition-settle classes', () => {
      expect(cssContent).toContain('.cq-motion-scope');
      expect(cssContent).toContain('.cq-transition-reveal');
      expect(cssContent).toContain('.cq-transition-reveal.is-visible {');
      expect(cssContent).toContain('.cq-transition-settle {');
    });

    it('includes a prefers-reduced-motion media query collapsing tokens to instant', () => {
      expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
      expect(cssContent).toContain('--cq-motion-press: var(--cq-motion-instant);');
    });
  });

  describe('Real Call Site Integration', () => {
    it('verifies SoundToggleControl integrates useSoundPreference and confirmHaptic', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/game-effects/SoundToggleControl.tsx'),
        'utf8'
      );
      expect(fileContent).toContain('useSoundPreference');
      expect(fileContent).toContain('confirmHaptic');
      expect(fileContent).toContain('cq-transition-settle');
    });
  });
});
