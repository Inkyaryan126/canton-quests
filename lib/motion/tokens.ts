/**
 * Canton Quests — shared motion design tokens.
 *
 * Single source of truth for transition durations and easing curves behind
 * the "issued field equipment" feel (crisp, mechanical, never bouncy/playful).
 *
 * CSS consumers: read the matching custom properties from
 * `primitives.module.css` (`var(--cq-motion-press)`, `var(--cq-motion-ease-standard)`)
 * rather than hardcoding ms/easing values inline.
 *
 * JS consumers: use these constants when a raw number is unavoidable (e.g.
 * aligning a `setTimeout` stagger to a CSS transition length). Keep this
 * file and `primitives.module.css` numerically in sync.
 */

export const MOTION_TOKENS = {
  instant: 0,
  press: 100,
  settle: 180,
  reveal: 280,
  easings: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0, 0, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

export type MotionDurationToken = 'instant' | 'press' | 'settle' | 'reveal';
export type MotionEasingToken = keyof typeof MOTION_TOKENS.easings;
