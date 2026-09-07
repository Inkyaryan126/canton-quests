# lib/motion — Motion Primitives

CSS-first transition/easing tokens, a shared `prefers-reduced-motion`
primitive, and optional haptic feedback for a consistent "issued field
equipment" feel across Canton Quests. This is **not** a JS animation
library — no new animation/particle dependency was added, and none should
be, to keep this a small, cosmetic-JS-budget-friendly module (see the
50KB gzip guidance in the Phase 2 task).

## Tokens (`tokens.ts` / `primitives.module.css`)

| Token | Value | Use for |
|---|---|---|
| `--cq-duration-instant` / `MOTION_DURATIONS.instant` | 0ms | No-op / already-instant state changes |
| `--cq-duration-fast` / `MOTION_DURATIONS.fast` | 120ms | Hover/focus micro-feedback |
| `--cq-duration-base` / `MOTION_DURATIONS.base` | 220ms | Default transitions (toggles, panel state changes) |
| `--cq-duration-slow` / `MOTION_DURATIONS.slow` | 360ms | Larger reveals (fade-ins, overlays) |

Easings: `--cq-ease-standard` (default), `--cq-ease-out` (entrances),
`--cq-ease-in` (exits). Mirrored as `MOTION_EASINGS.standard/out/in` in JS.

**Rule: don't hardcode `transition: ... 150ms ease` inline.** Import the CSS
module and use its classes, or reference the custom properties directly:

```tsx
import motionStyles from '@/lib/motion/primitives.module.css';

<button className={`my-btn ${motionStyles.transitionBase}`}>...</button>
```

```css
.my-custom-thing {
  transition-duration: var(--cq-duration-fast);
  transition-timing-function: var(--cq-ease-standard);
}
```

`tokens.ts` and `primitives.module.css` must stay numerically in sync —
treat `tokens.ts` as the JS-side mirror for cases where a raw number is
unavoidable (e.g. staggering a haptic pulse to a transition length).

## Reduced motion (`reduced-motion.ts`)

This is the **single shared primitive** for `prefers-reduced-motion`. Do not
add another `matchMedia('(prefers-reduced-motion: reduce)')` check anywhere
in the app.

- CSS-only components get reduced motion for free: `primitives.module.css`
  already contains the `@media (prefers-reduced-motion: reduce)` override
  that zeroes every duration token and utility class transition/animation.
- Components that need to branch in JS (e.g. skip a purely decorative
  effect entirely) should use `useReducedMotion()`:

```tsx
import { useReducedMotion } from '@/lib/motion';

const reduced = useReducedMotion();
if (!reduced) {
  // play a purely cosmetic effect
}
```

- Non-React code can use `prefersReducedMotion()` (one-off read) or
  `subscribeToReducedMotionChange(listener)` (live updates).

All three are SSR-safe and resolve to "motion is fine" (`false`) when
`window`/`matchMedia` aren't available, rather than throwing.

## Haptics (`haptics.ts`)

Optional, feature-detected `navigator.vibrate` wrapper. Use sparingly, for
key confirmations only (e.g. toggling a persistent setting) — never for
routine clicks, and never as something the interaction depends on:

```tsx
import { triggerHaptic } from '@/lib/motion';

function onConfirm() {
  triggerHaptic(); // no-ops safely on unsupported platforms (desktop, iOS Safari)
}
```

`isHapticsSupported()` is available if a caller needs to know up front, but
`triggerHaptic()` itself is already safe to call unconditionally.

## Sound preference

Motion primitives are intentionally separate from the sound-preference
primitive — see `lib/audio/README.md` for `useSoundPreference()`, the
single documented way to read/toggle the global sound setting.
