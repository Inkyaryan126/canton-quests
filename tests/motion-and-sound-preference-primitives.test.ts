import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  prefersReducedMotion,
  subscribeToReducedMotionChange,
  useReducedMotion,
  isHapticsSupported,
  triggerHaptic,
  MOTION_HAPTIC_CONFIRM_PATTERN,
  MOTION_DURATIONS,
  MOTION_EASINGS,
} from '../lib/motion';
import { cqSoundManager, getSoundPreferenceSnapshot, subscribeSoundPreference } from '../lib/audio';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

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
}

class MockAudio {
  public src: string;
  public volume = 1.0;
  public currentTime = 0;
  public paused = true;
  public ended = false;
  public preload = 'auto';
  public onended: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  constructor(src?: string) {
    this.src = src || '';
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
}

describe('lib/motion — prefers-reduced-motion primitive', () => {
  const originalWindow = (global as any).window;

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (global as any).window;
    } else {
      (global as any).window = originalWindow;
    }
  });

  it('is SSR-safe: resolves to false when window/matchMedia is unavailable', () => {
    delete (global as any).window;
    expect(prefersReducedMotion()).toBe(false);
  });

  it('resolves to false when the OS/browser reports no reduced-motion preference', () => {
    (global as any).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    };
    expect(prefersReducedMotion()).toBe(false);
  });

  it('respects the OS/browser reduced-motion preference when set — the core acceptance requirement', () => {
    (global as any).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    };
    expect(prefersReducedMotion()).toBe(true);
  });

  it('never throws if matchMedia itself throws (e.g. locked-down environments)', () => {
    (global as any).window = {
      matchMedia: vi.fn().mockImplementation(() => {
        throw new Error('blocked');
      }),
    };
    expect(() => prefersReducedMotion()).not.toThrow();
    expect(prefersReducedMotion()).toBe(false);
  });

  it('subscribeToReducedMotionChange delivers live updates and can be unsubscribed', () => {
    let capturedHandler: ((e: { matches: boolean }) => void) | null = null;
    const addEventListener = vi.fn((_event: string, handler: any) => {
      capturedHandler = handler;
    });
    const removeEventListener = vi.fn();
    (global as any).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener, removeEventListener }),
    };

    const listener = vi.fn();
    const unsubscribe = subscribeToReducedMotionChange(listener);

    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    capturedHandler!({ matches: true });
    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('subscribeToReducedMotionChange is a safe no-op when matchMedia is unavailable', () => {
    delete (global as any).window;
    const listener = vi.fn();
    const unsubscribe = subscribeToReducedMotionChange(listener);
    expect(() => unsubscribe()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('useReducedMotion is exported as a function (React hook wrapper around the primitive)', () => {
    expect(typeof useReducedMotion).toBe('function');
  });
});

describe('lib/motion/primitives.module.css — CSS-first tokens actually zero out under reduced motion', () => {
  const css = readSource('lib/motion/primitives.module.css');

  it('defines duration and easing tokens as CSS custom properties, not inline magic numbers', () => {
    expect(css).toContain('--cq-duration-fast: 120ms;');
    expect(css).toContain('--cq-duration-base: 220ms;');
    expect(css).toContain('--cq-duration-slow: 360ms;');
    expect(css).toContain('--cq-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);');
  });

  it('has a single @media (prefers-reduced-motion: reduce) block that overrides every duration token to ~0', () => {
    const match = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/);
    expect(match).not.toBeNull();
    const block = match![1];
    expect(block).toContain('--cq-duration-fast: 0ms;');
    expect(block).toContain('--cq-duration-base: 0ms;');
    expect(block).toContain('--cq-duration-slow: 0ms;');
    expect(block).toMatch(/transition-duration: 0\.01ms !important;/);
    expect(block).toMatch(/animation-duration: 0\.01ms !important;/);
  });

  it('every utility class transition-tied to a token is also covered by the reduced-motion override', () => {
    const classNames = [...css.matchAll(/^\.(\w+)\s*\{/gm)].map((m) => m[1]);
    const reducedBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const className of classNames) {
      expect(reducedBlock, `.${className} is not covered by the reduced-motion override`).toContain(`.${className}`);
    }
  });
});

describe('lib/motion — tokens are documented and internally consistent', () => {
  it('duration tokens escalate instant < fast < base < slow', () => {
    expect(MOTION_DURATIONS.instant).toBeLessThan(MOTION_DURATIONS.fast);
    expect(MOTION_DURATIONS.fast).toBeLessThan(MOTION_DURATIONS.base);
    expect(MOTION_DURATIONS.base).toBeLessThan(MOTION_DURATIONS.slow);
  });

  it('easing tokens are valid cubic-bezier() strings', () => {
    Object.values(MOTION_EASINGS).forEach((easing) => {
      expect(easing).toMatch(/^cubic-bezier\([-0-9., ]+\)$/);
    });
  });

  it('tokens.ts and primitives.module.css stay numerically in sync', () => {
    const css = readSource('lib/motion/primitives.module.css');
    expect(css).toContain(`--cq-duration-fast: ${MOTION_DURATIONS.fast}ms;`);
    expect(css).toContain(`--cq-duration-base: ${MOTION_DURATIONS.base}ms;`);
    expect(css).toContain(`--cq-duration-slow: ${MOTION_DURATIONS.slow}ms;`);
    expect(css).toContain(`--cq-ease-standard: ${MOTION_EASINGS.standard};`);
  });
});

describe('lib/motion — haptics primitive (feature-detected, optional, never required)', () => {
  const originalNavigator = (global as any).navigator;

  afterEach(() => {
    if (originalNavigator === undefined) {
      delete (global as any).navigator;
    } else {
      (global as any).navigator = originalNavigator;
    }
  });

  it('reports unsupported when navigator is unavailable (SSR)', () => {
    delete (global as any).navigator;
    expect(isHapticsSupported()).toBe(false);
  });

  it('reports unsupported when navigator.vibrate does not exist (e.g. desktop/iOS Safari)', () => {
    (global as any).navigator = {};
    expect(isHapticsSupported()).toBe(false);
  });

  it('reports supported when navigator.vibrate is a function', () => {
    (global as any).navigator = { vibrate: vi.fn() };
    expect(isHapticsSupported()).toBe(true);
  });

  it('triggerHaptic never throws and returns false when unsupported', () => {
    delete (global as any).navigator;
    expect(() => triggerHaptic()).not.toThrow();
    expect(triggerHaptic()).toBe(false);
  });

  it('triggerHaptic calls navigator.vibrate with the shared confirm pattern by default', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    (global as any).navigator = { vibrate };
    const result = triggerHaptic();
    expect(vibrate).toHaveBeenCalledWith(MOTION_HAPTIC_CONFIRM_PATTERN);
    expect(result).toBe(true);
  });

  it('triggerHaptic swallows errors thrown by navigator.vibrate rather than degrading the experience', () => {
    (global as any).navigator = {
      vibrate: vi.fn().mockImplementation(() => {
        throw new Error('permission denied');
      }),
    };
    expect(() => triggerHaptic()).not.toThrow();
    expect(triggerHaptic()).toBe(false);
  });
});

describe('lib/audio — shared sound-preference primitive reuses cqSoundManager (no duplicated state)', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    (global as any).window = {
      localStorage: mockStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (global as any).Audio = MockAudio;
    cqSoundManager.resetForTesting();
    cqSoundManager.setSoundEnabled(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cqSoundManager.resetForTesting();
    delete (global as any).window;
    delete (global as any).Audio;
  });

  it('getSoundPreferenceSnapshot reflects cqSoundManager state directly', () => {
    expect(getSoundPreferenceSnapshot()).toBe(true);
    cqSoundManager.setSoundEnabled(false);
    expect(getSoundPreferenceSnapshot()).toBe(false);
  });

  it('subscribeSoundPreference fires immediately with the current value and again on every change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSoundPreference(listener);

    expect(listener).toHaveBeenCalledWith(true);

    cqSoundManager.setSoundEnabled(false);
    expect(listener).toHaveBeenLastCalledWith(false);

    cqSoundManager.toggleSound();
    expect(listener).toHaveBeenLastCalledWith(true);

    unsubscribe();
    cqSoundManager.setSoundEnabled(false);
    // Unsubscribing must actually stop delivery — call count frozen at 3.
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('does not introduce a second persisted preference — still only cq_sound_enabled/canton_effects_muted are written', () => {
    cqSoundManager.setSoundEnabled(false);
    expect(mockStorage.getItem('cq_sound_enabled')).toBe('false');
    // No unrelated sound-preference key should ever be written by this module.
    expect(mockStorage.getItem('cq_sound_preference')).toBeNull();
  });
});

describe('components/game-effects/SoundToggleControl.tsx — real integration call site', () => {
  const source = readSource('components/game-effects/SoundToggleControl.tsx');

  it('uses the shared useSoundPreference hook instead of hand-rolled subscribe/useState boilerplate', () => {
    expect(source).toContain("import { cqSoundManager, useSoundPreference } from '@/lib/audio';");
    expect(source).toContain('useSoundPreference()');
    expect(source).not.toContain('cqSoundManager.subscribe(');
  });

  it('uses the shared motion primitives module for its transition and haptic confirmation', () => {
    expect(source).toContain("import { triggerHaptic } from '@/lib/motion';");
    expect(source).toContain("import motionStyles from '@/lib/motion/primitives.module.css';");
    expect(source).toContain('motionStyles.transitionBase');
    expect(source).toContain('triggerHaptic()');
  });
});

describe('lib/motion — no new heavy animation/particle dependency was introduced', () => {
  const disallowed = ['framer-motion', 'gsap', 'lottie', 'three', 'anime', 'react-spring', 'motion/react'];
  const files = ['lib/motion/tokens.ts', 'lib/motion/reduced-motion.ts', 'lib/motion/haptics.ts', 'lib/motion/index.ts'];

  it.each(files)('%s imports nothing beyond React/relative modules', (file) => {
    const content = readSource(file);
    const importLines = [...content.matchAll(/^import .* from ['"]([^'"]+)['"];?$/gm)].map((m) => m[1]);
    for (const importPath of importLines) {
      const isReact = importPath === 'react';
      const isRelative = importPath.startsWith('.');
      expect(isReact || isRelative, `${file} has an unexpected import: ${importPath}`).toBe(true);
    }
    for (const dep of disallowed) {
      expect(content).not.toContain(dep);
    }
  });
});
