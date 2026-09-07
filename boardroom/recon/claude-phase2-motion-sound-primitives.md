# Phase 2 — Core experience system: sound, motion & reduced-motion primitives

Boardroom task TASK-20260906-060724-zvme.

## What this adds

**`lib/motion/`** — CSS-first motion primitives (new module):
- `tokens.ts` — `MOTION_DURATIONS` / `MOTION_EASINGS` JS constants (documented, single source of truth for raw numbers when CSS custom properties aren't reachable).
- `primitives.module.css` — the same tokens as CSS custom properties (`--cq-duration-*`, `--cq-ease-*`) plus `.transitionFast/Base/Slow` and `.fadeIn` utility classes, all zeroed under one shared `@media (prefers-reduced-motion: reduce)` block.
- `reduced-motion.ts` — the single shared `prefers-reduced-motion` primitive: `prefersReducedMotion()` (one-off read), `subscribeToReducedMotionChange()` (live updates outside React), `useReducedMotion()` (React hook wrapper). SSR-safe — resolves to `false` with no `window`/`matchMedia`.
- `haptics.ts` — `isHapticsSupported()` / `triggerHaptic()`, a feature-detected, try/catch-guarded `navigator.vibrate` wrapper. Never throws, never required.
- `index.ts` — barrel re-exporting the above (not the `.module.css`, which is imported directly by consumers).
- `README.md` — usage guidance and the "don't hardcode a new `@media (prefers-reduced-motion...)` block" rule.

No animation/particle dependency was added. Total new source across `lib/motion/*` is ~7.7KB uncompressed (well under the 50KB gzip guidance for cosmetic JS) — no decision record was needed.

**`lib/audio/`** — sound-preference primitive (built on the existing `cqSoundManager`, not a parallel store):
- `use-sound-preference.ts` — `getSoundPreferenceSnapshot()`, `subscribeSoundPreference()`, and the `useSoundPreference()` hook. All three delegate to `cqSoundManager.isSoundEnabled()/subscribe()/setSoundEnabled()/toggleSound()` — no new persisted key, no duplicated state.
- `README.md` — documents this as the one supported pattern: `cqSoundManager` directly outside React, `useSoundPreference()` inside components.

**`components/game-effects/SoundToggleControl.tsx`** — the real integration call site:
- Replaced its hand-rolled `useState` + `cqSoundManager.subscribe` boilerplate with `useSoundPreference()`.
- Added the shared `motionStyles.transitionBase` class alongside its existing global `.cq-sound-toggle-btn` class.
- Added a sparing, feature-detected `triggerHaptic()` call on toggle (a "key confirmation," not a routine click).

## Known pre-existing duplication (out of WRITE_SCOPE, left alone)

`lib/game-effects.ts`'s `gameMomentManager` maintains its **own** separate
`soundEnabled` flag (with its own `localStorage` read of `cq_sound_enabled`)
that is synced manually from `SoundToggleControl`'s click handler
(`gameMomentManager.setSoundEnabled(next)`), and `lib/game-audio.ts`'s
`proceduralSoundEngine` maintains a third `isMuted` flag layered on top of
`cqSoundManager`. Neither file is in this task's WRITE_SCOPE
(`lib/audio/`, `components/game-effects/SoundToggleControl.tsx`,
`lib/motion/`, `boardroom/recon/`, `tests/`), so they were not touched.
`useSoundPreference()` is the new single documented primitive going
forward; a future pass that touches `lib/game-effects.ts`/`lib/game-audio.ts`
should migrate them to read `cqSoundManager` (or this hook) instead of
tracking their own flags, rather than adding a fourth source of truth.

## Verification

`node`/`npm`/`npx` invocations were not permitted to execute in this
sandboxed run (Bash approval was denied for all of them, including a bare
`node -e "1+1"` sanity check), so `npm test` / `npm run build` could not be
run directly here. Verified instead by:
- Manual review of `tsconfig.json` (`next-env.d.ts` pulls in `next`'s
  ambient `*.module.css` typings, so the new CSS Module import type-checks)
  and confirming no other repo file already needed a CSS Modules pattern to
  copy from (none existed — this is the first `.module.css` in the repo,
  a deliberate choice to avoid touching `app/globals.css`, which is outside
  WRITE_SCOPE).
- Hand-tracing every new test in
  `tests/motion-and-sound-preference-primitives.test.ts` against the exact
  implementation (mock call sequencing for `cqSoundManager.subscribe`,
  regex captures against the literal `primitives.module.css` text, etc.).
- Confirming no test/component in the repo imports
  `SoundToggleControl.tsx` as a module (only reads its source as text via
  `fs`), so the new `.module.css` import is never executed under Vitest's
  `environment: 'node'` config — it is only exercised by `next build`
  (which has first-class CSS Modules support) and the browser.
