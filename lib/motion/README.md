# Field-control motion

Use native CSS transitions for short, deliberate equipment feedback. Import the
CSS module and add its class to the actual interactive element:

```tsx
import motion from '@/lib/motion/primitives.module.css';
<button className={`cq-existing-control ${motion['cq-motion-control']}`}>
  Confirm
</button>
```

The real `SoundToggleControl` uses this primitive. The class carries its tokens
locally, so no layout import, provider, runtime style injection, or global
stylesheet edit is required. This scoped CSS module is the write-scope-safe
home for Phase 2 styles; it uses explicit CQ-prefixed classes, not Tailwind.

| CSS token | Value | Purpose |
| --- | --- | --- |
| `--cq-motion-press` | `100ms` | Short button engagement |
| `--cq-motion-settle` | `180ms` | Color/border change and release |
| `--cq-motion-ease-engage` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Quick response, controlled stop |
| `--cq-motion-ease-release` | `cubic-bezier(0.4, 0, 1, 1)` | Decisive press |

The primitive transitions color, background, border and a 1px press displacement.
It intentionally avoids `transition: all`, loops, particles, and spring physics.
Under `prefers-reduced-motion: reduce`, the same shared class removes transitions,
animation, and displacement, including while pressed. State changes remain
immediate and visible. Do not depend on a transition event to complete work.

For effects that cannot be expressed in CSS, use `useReducedMotion()` from
`@/lib/motion/use-reduced-motion` in React, or `prefersReducedMotion()` and
`subscribeReducedMotion()` from `@/lib/motion/reduced-motion` outside React.
They use one lazy native MediaQueryList and observe OS preference changes.
SSR and browsers without matchMedia conservatively report reduced motion.
Keep per-component media-query listeners out of new code. This slice does not
migrate existing game overlays or their legacy reduced-motion state.

## Optional haptics

`confirmHaptic(explicitlyEnabled)` from `@/lib/motion/haptics` is synchronous,
best-effort feedback for a confirmed user action. The default is **off**. It
feature-detects `navigator.vibrate`, respects reduced motion and hidden tabs,
uses one 15ms pulse, and limits accepted pulses to one per 700ms. Unsupported,
denied, and throwing implementations return `false`; never gate an action on it.
No timers, polling, permission prompt, or fallback effect are created.

`SoundToggleControl` accepts optional `hapticsEnabled` and calls the helper only
on unmute confirmation. Existing callers omit the prop, so they remain vibration
free. Do not attach haptics to navigation, hover, repeated XP ticks, or rendering.

## Verification

- `npm test -- tests/motion-and-sound-preference-primitives.test.ts tests/cq-tactical-sound-system.test.ts`
- `node tests/motion-and-sound-preference.browser.mjs` exercises the real toggle,
  stored mute, multiple mounted consumers, haptics, CSS cascade, and live OS
  preference changes in a 390px browser fixture. Requires working local Chrome
  or Playwright Chromium. This is a component fixture, not production E2E.
