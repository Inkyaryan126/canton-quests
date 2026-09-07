/**
 * Canton Quests — Motion Primitives
 *
 * Single entry point for the shared transition/easing tokens, the
 * prefers-reduced-motion primitive, and optional haptic feedback. See
 * README.md in this directory for usage guidance.
 *
 * CSS tokens/utility classes are not re-exported here (CSS Modules aren't
 * JS values) — import them directly where needed:
 *   import motionStyles from '@/lib/motion/primitives.module.css';
 */

export * from './tokens';
export * from './reduced-motion';
export * from './haptics';
