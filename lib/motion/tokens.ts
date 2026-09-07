/**
 * Canton Quests — shared motion design tokens.
 *
 * Single source of truth for transition durations and easing curves behind
 * the "issued field equipment" feel (crisp, mechanical, never bouncy/playful).
 *
 * CSS consumers: read the matching custom properties from
 * `primitives.module.css` (`var(--cq-duration-base)`, `var(--cq-ease-standard)`)
 * rather than hardcoding ms/easing values inline.
 *
 * JS consumers: use these constants when a raw number is unavoidable (e.g.
 * aligning a `setTimeout` stagger to a CSS transition length). Keep this
 * file and `primitives.module.css` numerically in sync.
 */

export const MOTION_DURATIONS = {
  instant: 0,
  fast: 120,
  base: 220,
  slow: 360,
} as const;

export const MOTION_EASINGS = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

export type MotionDurationToken = keyof typeof MOTION_DURATIONS;
export type MotionEasingToken = keyof typeof MOTION_EASINGS;
