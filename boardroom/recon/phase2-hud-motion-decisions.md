# Phase 2 — HUD states, cinematic transitions & interaction feedback

**Task:** `TASK-20260906-060727-3kic` · **Base commit:** `a17c7fe1e07a0bd1c05bbde5a826b7e95eaa1d9e`
**Depends on (same run, same write scope):** `TASK-20260906-060724-zvme` (sound/motion primitives) — that task had not landed a committed result, so this checkpoint also creates `lib/motion/` and `lib/audio/sound-preference.ts` as the dependency, per the run's expanded WRITE_SCOPE covering both tasks.

## What this checkpoint adds

- `lib/motion/index.ts`, `lib/motion/use-reduced-motion.ts`, `lib/motion/primitives.module.css`,
  `lib/motion/README.md` — CSS-first duration/easing tokens (`--cq-motion-press/settle/reveal`),
  a `useReducedMotion()` hook, and an opt-in `confirmHaptic()` (feature-detected
  `navigator.vibrate`, never blocking).
- `lib/audio/sound-preference.ts`, `lib/audio/README.md` — `useSoundPreference()` reads the
  existing `cqSoundManager` singleton via `useSyncExternalStore`; no new preference store.
- `components/game-effects/HudSystemState.tsx` — the `armed | scanning | confirmed | denied`
  system-state primitive (icon + `role="status"` text, independent of color for a11y).
- `components/game-effects/HudTransition.tsx` — the one section-arrival transition primitive,
  built on `lib/motion/primitives.module.css`'s `cq-motion-scope`/`cq-motion-open`.
- `components/game-effects/LazyHudParticles.tsx` — `React.lazy()` wrapper around
  `HudParticlesCanvas`; renders nothing under reduced motion or on the server.
- `app/globals.css` — new `.cq-hud-state*` / `.cq-field-*` classes (no Tailwind).

## Real usage (checkpoint requirement: at least 2 real call sites)

- `CityScanOverlay.tsx` and `RewardTokenEffect.tsx` (both real, already-wired game-moment
  overlays triggered from live gameplay, not demo pages) now render through
  `HudSystemState` + `HudTransition` instead of bespoke Tailwind markup.
- All 11 particle-consuming effect components (`AchievementEffect`, `ChainCompleteEffect`,
  `FieldEventEffect`, `FinaleQualificationEffect`, `MajorCinematicEffect`, `PathLockEffect`,
  `ProgressionEffect`, `QuestCompleteEffect`, `RankUpEffect`, `RewardTokenEffect`,
  `ThreeLocksFragmentEffect`, `UnlockEffect`) now import `HudParticlesCanvas` through
  `LazyHudParticles` instead of directly.
- `GameEffectsProvider.tsx` lazy-loads `GameMomentOverlay` itself (`React.lazy` + `Suspense`,
  only mounted once `state.currentMoment` is set), so none of the 16 effect components or the
  canvas particle engine are in the initial bundle for routes that never trigger a moment.
- `SoundToggleControl.tsx` now reads `useSoundPreference()` (dropping its own local state /
  manual subscribe) and applies `cq-motion-control` for its transition timing — this is the
  same component exercised by the existing `tests/motion-and-sound-preference-primitives.test.ts`.

## Why `React.lazy`, not `next/dynamic`, for the canvas/particle split

A prior attempt at this task (salvage tag
`boardroom-salvage/20260906-145610-fbec/TASK-20260906-060727-3kic-attempt2`) added
`next/dynamic()` calls directly inside `GameMomentOverlay.tsx`, passing a shared
`dynamicMomentOptions` object as the second argument for four of the effect imports.
Boardroom's independent re-verification of that salvage confirmed `npm test` passed fully
(1999/1999) but `npm run build` failed with a real, reproducible error: `next/dynamic`
requires its options argument to be an inline object literal for build-time static analysis,
so a shared-variable reference broke the build.

This checkpoint avoids that failure mode entirely by not touching `GameMomentOverlay.tsx`'s
imports at all. Instead:
1. `GameEffectsProvider.tsx` lazy-loads the whole `GameMomentOverlay` module with a single
   `React.lazy(() => import('./GameMomentOverlay'))`, gated on `state.currentMoment` — no
   `next/dynamic` options object anywhere.
2. Each effect component swaps its own `HudParticlesCanvas` import for `LazyHudParticles`,
   which wraps `React.lazy` itself (again, no `next/dynamic`, no shared options literal).

Both lazy boundaries use plain `React.lazy` + `Suspense`, which has no equivalent
static-analysis constraint, so this sidesteps the documented failure rather than
reproducing it.

## Reuse note

This checkpoint's `lib/motion/*`, `lib/audio/sound-preference.ts`, and their tests are
functionally identical to the independently-verified-safe salvage
`boardroom-salvage/20260906-145610-fbec/TASK-20260906-060724-zvme-attempt3`
(confirmed by Boardroom: `npm test` 1975/1975 and `npm run build` both pass against that
exact file set). The HUD/transition components and their integration into `CityScanOverlay`
/ `RewardTokenEffect` / `GameEffectsProvider` / the 11 particle call sites were recreated from
a later, more complete but not-yet-validated attempt
(`boardroom-salvage/20260906-234245-1bd6/TASK-20260906-060727-3kic-attempt4`, cut short by
agent usage exhaustion rather than a defect) after manual review of every diff against the
current base commit. Nothing was `git stash apply`-ed directly; every file was re-authored
by hand after inspecting the salvaged diff.

## Not done in this checkpoint

- Cross-tab sound-preference sync (out of scope — same-document only, as before).
- Migrating the legacy `gameMomentManager.setSoundEnabled` call in `SoundToggleControl` off
  the deprecated path — kept for existing overlay compatibility.
- Applying `HudSystemState`/`HudTransition` to every remaining effect component beyond the
  two converted here; the acceptance bar was "at least 2 real places," which is met, and
  further conversions are lower-risk follow-up work, not required for this checkpoint.
