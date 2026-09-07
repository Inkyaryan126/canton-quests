/**
 * Canton Quests — optional haptic confirmation primitive.
 *
 * Thin, feature-detected wrapper around `navigator.vibrate`. Always
 * best-effort: never throws, never blocks, and must never be required for
 * an interaction to feel complete — most desktop browsers and iOS Safari
 * have no support at all. Reserve `triggerHaptic()` for a handful of key
 * confirmations (e.g. toggling a persistent setting), not routine clicks.
 */

/** Short, subtle default pulse (ms) for a generic confirmation. */
export const MOTION_HAPTIC_CONFIRM_PATTERN = 15;

export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Fires a haptic pulse if the platform supports it. The return value is
 * informational only (whether a pulse was actually requested) — callers
 * must not branch UX behavior on it, since haptics are always optional.
 */
export function triggerHaptic(pattern: number | number[] = MOTION_HAPTIC_CONFIRM_PATTERN): boolean {
  if (!isHapticsSupported()) {
    return false;
  }
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
