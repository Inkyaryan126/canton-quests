# Field-equipment motion primitives

Import `motion` from `@/lib/motion/primitives.module.css` and apply
`motion['cq-motion-control']` to a control. `SoundToggleControl` is the integrated
example. These are explicit CQ CSS classes; no animation dependency is used.

For a larger surface, apply `motion['cq-motion-scope']` to its container and use the
inherited custom properties in scoped CSS, or use the shared `HudTransition`
component (`components/game-effects/HudTransition.tsx`) which already applies
`cq-motion-scope` + `cq-motion-open` for a section's arrival. Do not copy timings
into inline styles.

| Token | Default | Purpose |
| --- | --- | --- |
| `--cq-motion-instant` | 0ms | Immediate feedback |
| `--cq-motion-press` | 100ms | Control color/border response |
| `--cq-motion-settle` | 180ms | Small panel/state transitions |
| `--cq-motion-reveal` | 280ms | Brief arrival/reveal |
| `--cq-motion-ease-standard` | cubic-bezier(0.2, 0, 0, 1) | Firm response, soft stop |
| `--cq-motion-ease-enter` | cubic-bezier(0, 0, 0.2, 1) | Arrival |
| `--cq-motion-ease-exit` | cubic-bezier(0.4, 0, 1, 1) | Departure |

The shared media query makes all duration tokens instantaneous under
`prefers-reduced-motion: reduce`, before hydration and on live OS changes.
The control primitive transitions only color, background, border, and opacity;
it suppresses animations and delays in reduced mode. Scope supplies tokens, not a
blanket override of arbitrary descendant animations. Future animated consumers
must provide visible final states without relying on `transitionend`/`animationend`.

Imperative cosmetic work uses `prefersReducedMotion()` from `@/lib/motion` at the
point of use, or the `useReducedMotion()` hook from `@/lib/motion/use-reduced-motion`
in components (used by `LazyHudParticles` to skip mounting the canvas entirely).
SSR or unavailable `matchMedia` returns true. For long-running work, prefer CSS so
live preference changes take effect without JS listeners.

`confirmHaptic({ enabled: true })` attempts one 12ms pulse. Opt-in defaults to false;
call only directly from a user gesture confirming a meaningful action. It respects
reduced motion and safely returns false for absent, denied, or throwing vibration
APIs. Never await vibration or use its result to determine gameplay success.
`SoundToggleControl` exposes optional `hapticsEnabled` and attempts it only when
enabling sound. Existing callers do not opt in, so no vibration is added by default.

Verification: `npm test -- tests/motion-and-sound-preference-primitives.test.ts`;
`node tests/motion-and-sound-browser.mjs` mounts two real toggles and checks their
sync and computed CSS under live reduced-motion changes using installed Chrome
or Playwright Chromium. Neither check requires player authentication or data writes.
