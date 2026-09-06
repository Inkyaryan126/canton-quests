# Phase 2 — HUD states, cinematic transitions & interaction feedback

**Decision record · Boardroom task `Phase 2: Core experience system -- HUD states, cinematic transitions & interaction feedback`**

## Why this task also touched `lib/audio/` and `lib/motion/`

The task's GOAL depends on "the Phase 2 motion primitives from the sound/motion task"
(`TASK-20260906-060724-zvme`), but that task never landed — every attempt failed on
unrelated pre-existing issues (a `transmission-archive-reveal.test.ts` failure and a
usage-exhaustion timeout), and its salvaged work sat in `git stash` uncommitted. This
task's WRITE_SCOPE explicitly includes `lib/audio/` and `lib/motion/`, so rather than
build page transitions on nothing, the primitives were finished here:

- `lib/motion/index.ts` — `prefersReducedMotion()`, `useReducedMotion()`,
  `confirmHaptic()`. Duration/easing tokens live in `app/globals.css` as
  `.cq-motion-*` custom properties instead of a separate CSS module, since
  `app/globals.css` is in-scope here (it wasn't for the original task).
- `lib/audio/sound-preference.ts` — `useSoundPreference()` wrapping
  `cqSoundManager` via `useSyncExternalStore`. `cqSoundManager` stays the only
  store; this just removes the manual subscribe/useState boilerplate.

## What "used in at least 2 real places" means here

WRITE_SCOPE for this task is `components/game-effects/`, `app/globals.css`,
`lib/audio/`, `lib/motion/`, `boardroom/recon/`, `tests/` — it does not include
`app/*` pages or components outside `game-effects/`. So integration had to happen
through components that are *already* real (triggered from live app flows), not by
wiring new call sites into out-of-scope files:

- `SystemStatusBadge` (`armed`/`scanning`/`confirmed`/`denied`) replaces ad hoc
  status pills in `CityScanOverlay.tsx` and `PathLockEffect.tsx` — both dispatched
  by `GameMomentOverlay` for real `showGameMoment({type:'city-scan'|'path-lock'})`
  calls from `app/auth/confirm/page.tsx`, `components/ThreePathSelector.tsx`, and
  `components/FastPlayerOnboardForm.tsx`. It also became the lazy-load fallback
  for every dynamically-imported moment effect (see below) — a fourth real site.
  `QuestListScanEffect.tsx` was updated too, but it currently has no caller
  anywhere in the app (pre-existing — not introduced by this task); it's not
  counted toward the "real places" claim.
- `CqTransition` (the `.cq-transition-reveal`/`.cq-transition-settle` primitive)
  replaces the ad hoc `transition-opacity duration-300` / `transition-all
  duration-500` inline values in the same two components, so their arrival
  animation now reads off the shared `--cq-motion-*` tokens instead of one-off
  numbers per component.
- `SoundToggleControl.tsx` now reads `useSoundPreference()` instead of its own
  `useState`/`useEffect` sync loop; its two real mounts (`CinematicNav.tsx`,
  `components/Header.tsx`) get this for free.

## Lazy-loading canvas/particle effects

`boardroom/recon/claude-performance-baseline.md` (Phase 1) already measured this
exact problem: `GameMomentOverlay` statically imported all ~18 moment-effect
components, so all of them — including the 12 that render `HudParticlesCanvas`
(`<canvas>` + `requestAnimationFrame`) — shipped in the shared bundle for every
route, even ones that never trigger a game moment. `GameMomentOverlay.tsx` now
wraps those 12 (`PathLockEffect`, `QuestCompleteEffect`, `RankUpEffect`,
`AchievementEffect`, `ChainCompleteEffect`, `FinaleQualificationEffect`,
`ThreeLocksFragmentEffect`, `RewardTokenEffect`, `UnlockEffect`, `FieldEventEffect`,
`ProgressionEffect`, `MajorCinematicEffect`) in `next/dynamic(..., { ssr: false })`,
matching the existing wrapper convention (`SectorMapWrapper.tsx` et al.). The other
four (`CityScanOverlay`, `CommanderTransmissionEffect`, `CommanderTextTransmission`,
`FlashDropEffect`) render no canvas and stay as regular imports. The dynamic
loading fallback is a `SystemStatusBadge status="scanning"` on the existing moment
backdrop treatment (`.cq-moment-loading` in `app/globals.css`) rather than a blank
flash.

## What was deliberately left alone

- `lib/game-effects.ts` (`GameMomentManager`)'s own OS `prefers-reduced-motion`
  listener and internal `reducedMotion`/`soundEnabled` state were not touched or
  routed through the new `lib/motion`/`lib/audio` primitives — that file is
  outside this task's WRITE_SCOPE, and every effect component's existing
  `reducedMotion` prop behavior (stage-timing `setTimeout`s, etc.) is preserved
  exactly so gameplay pacing doesn't change.
- The ad hoc confirm/deny banners found outside `components/game-effects/`
  (`CipherFragmentsPanel.tsx`, `LocationVerifier.tsx`, the quest verification page,
  login/onboarding error panels) were not touched — they're outside WRITE_SCOPE.
  They're good candidates for a follow-up task once `SystemStatusBadge` needs to
  extend beyond the effects system.
