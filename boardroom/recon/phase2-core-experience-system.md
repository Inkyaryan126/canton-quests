# Phase 2 — sound and motion primitives

Date: 2026-09-06. Starting commit: `a17c7fe1e07a0bd1c05bbde5a826b7e95eaa1d9e`.

## Implemented checkpoint

- `lib/audio/use-sound-preference.ts` gives React a hydration-safe subscription
  to the existing `cqSoundManager`. No second store, provider, storage key, or
  sound engine was added. Imperative callers keep using the singleton directly.
- `SoundToggleControl` uses the hook and the motion CSS class in the real header,
  navigation, and overlay call sites. It exposes `aria-pressed`. Its legacy
  `soundEnabled` prop remains accepted but cannot override the global preference.
  The existing legacy game-moment notification on toggle is preserved.
- `lib/motion/primitives.module.css` provides 100ms/180ms timing and two easing
  tokens, applied to a restrained press/release primitive. Reduced motion removes
  transitions, animation, and press displacement in that shared CSS module.
- The shared native reduced-motion reader/subscription and optional React hook
  observe OS changes, support older MediaQueryList listeners, and conservatively
  disable effects during SSR or without matchMedia.
- `confirmHaptic` is explicitly opted in, feature-detected, reduced-motion-aware,
  hidden-tab-safe, and bounded to a 15ms pulse with a 700ms cooldown. It returns
  false for unsupported/denied/throwing implementations. The toggle calls it only
  on unmute confirmation; existing callers keep haptics off by default.
- Usage and migration limits are documented in `lib/audio/README.md` and
  `lib/motion/README.md`.

## Verification evidence

- PASS: focused audio/motion run, 26/26 tests (21 existing audio + 5 initial
  primitive tests). After adding hidden-tab/cooldown recovery and real-component
  SSR coverage, the new primitive suite passes 7/7.
- PASS: `npm run lint`, no warnings/errors.
- PASS: `npx tsc --noEmit --incremental false`, including the final test additions.
- PASS: esbuild compiled the real toggle browser fixture and its CSS module.
- BLOCKED: `node tests/motion-and-sound-preference.browser.mjs` could not launch
  local Chrome: process exited with `SIGABRT` before opening a page. Bundled
  Playwright Chromium is not installed. This harness is retained for a host with
  a working browser; rendered CSS, live mounted-toggle synchronization, and
  physical-device vibration are not claimed verified here. The native media
  subscription, reduced-motion haptic suppression, and SSR markup were executed
  in the unit tests.
- The initial plain `npm test` loaded `.env.local`; tests expecting local fallback
  mode attempted configured database requests and reported fetch/auth/timeouts.
  That run was interrupted (exit 130) after these failures. Verification then
  reran the full suite with `NEXT_PUBLIC_SUPABASE_URL=''`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=''`, and `SUPABASE_SERVICE_ROLE_KEY=''` for the
  command only. No environment files were edited.
- PASS: the complete isolated suite finished with **117/117 files and
  1,996/1,996 tests passing**, exit 0, in 298.33 seconds. This includes the final
  seven primitive/SSR tests and all 21 existing tactical-audio tests. The drawing,
  auth, cinematic-effects, Fair, and launch-readiness suites pass in this local
  mode. These results do not establish live database or production behavior.
- PASS: `git diff --check`. No staged changes; repository HEAD remains at the
  starting commit. Logs are `/tmp/cq-phase2-offline-suite.log`,
  `/tmp/cq-phase2-lint.log`, `/tmp/cq-phase2-types.log`, and
  `/tmp/cq-phase2-browser.log`.

## Measured weight

Minified esbuild bundle rooted at `SoundToggleControl`, with existing shared
`react` and `lucide-react` external, gzip-compressed using Node's `gzipSync`:

| Artifact | HEAD | Working change | Delta |
| --- | ---: | ---: | ---: |
| Component dependency JS | 5,516 bytes | 5,723 bytes | +207 bytes |
| Added CSS module | 0 bytes | 279 bytes | +279 bytes |

This compares the original component from `git show HEAD:...` with the edited
component under identical bundler options. It is a bounded component measurement,
not a new Next.js production route or whole-app cosmetic budget measurement.
No dependencies were added and no budget exception is needed for this slice.

## Scope and supervisor handoff

The supplied current scope explicitly permits `boardroom/recon/` and `tests/`,
including the previously reported blocker path
`tests/motion-and-sound-preference-primitives.test.ts`. Initial working tree was
clean. Application edits are restricted to the allowed audio/motion directories
and `components/game-effects/SoundToggleControl.tsx`. No gameplay, auth, database,
assets, package manifests, or global stylesheet files were edited.

PASS: Boardroom's real `evaluateChangedPaths` evaluated all 11 changed files
against the supplied scope and returned `decision: 'COMMIT'`, `outOfScope: []`.
This is a pure scope-gate result, not a performed commit or a validation override.

Boardroom retains staging and commit ownership. No staging, commit, push,
deployment, runtime-ledger rewrite, or attempt to reset unavailable agents was
performed. Agent availability remains the supervisor's concern, not a reason
to widen this task's write scope.

Legacy game-effect motion and cached sound state outside the allowed paths are
not migrated in this checkpoint. Live sound synchronization between browser tabs
is not added. Existing sound defaults, storage compatibility, map/asset lookup,
volume, cooldowns, and playback gates are preserved. The working slice is the
global toggle plus the documented primitives; it is not an app-wide legacy
animation conversion or a production-verified rollout.
