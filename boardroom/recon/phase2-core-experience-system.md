# Phase 2 — Core Experience System: Sound, Motion & Reduced-Motion Primitives

Task: TASK-20260906-060724-zvme

## Overview

This implementation establishes the foundation for tactical sound and CSS-first motion primitives:
1. **Global sound preference primitive**: `lib/audio/sound-preference.ts` provides `useSoundPreference()`, `getSoundPreference()`, and `subscribeSoundPreference()`. It connects directly to the existing `cqSoundManager` singleton using `useSyncExternalStore` with stable boolean snapshots and SSR hydration support. No duplicate state, store, or storage keys are introduced. Re-exported via `lib/audio/index.ts`.
2. **Motion tokens**: `lib/motion/tokens.ts` and `lib/motion/primitives.module.css` establish unified tokens for the issued-field-equipment aesthetic:
   - `--cq-motion-instant: 0ms`
   - `--cq-motion-press: 100ms`
   - `--cq-motion-settle: 180ms`
   - `--cq-motion-reveal: 280ms`
   - Standard, enter, and exit cubic-bezier easings.
   - Strictly pure CSS selectors (`.cq-motion-scope`, `.cq-motion-control`) avoiding impure `:root` syntax incompatible with Next.js webpack CSS modules.
3. **Prefers-reduced-motion handling**:
   - In CSS: `@media (prefers-reduced-motion: reduce)` zeroes `--cq-motion-press`, `--cq-motion-settle`, `--cq-motion-reveal` to 0ms and sets `animation: none; transition-delay: 0ms;`.
   - In JS: `prefersReducedMotion()` feature-detects `matchMedia` and defaults safely to `true` under SSR or unsupported environments.
4. **Haptic feedback**: `confirmHaptic({ enabled?: boolean })` wraps `navigator.vibrate` with strict feature detection, reduced-motion suppression, error handling, and opt-in requirement. Never throws or degrades where unsupported.
5. **Real call site integration**: `components/game-effects/SoundToggleControl.tsx` was refactored to use `useSoundPreference()`, the `motion['cq-motion-control']` class, and `confirmHaptic()`.

## Acceptance Criteria Verification

- `useSoundPreference()` is the single documented primitive app-wide for checking sound preference.
- All tokens are standardized in `tokens.ts` and `primitives.module.css`.
- `prefers-reduced-motion` is verified via unit tests and browser integration test.
- Haptics are strictly feature-detected and opt-in only.
- Zero new heavy dependencies added.
- Existing gameplay/auth/database behaviors remain untouched.
