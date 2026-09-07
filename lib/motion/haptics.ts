import { prefersReducedMotion } from './reduced-motion';

const CONFIRM_PULSE_MS = 15;
const CONFIRM_COOLDOWN_MS = 700;
let lastConfirmation = -Infinity;

/** Call in a confirmation gesture only. Explicit opt-in; never await or depend on success. */
export function confirmHaptic(enabled = false): boolean {
  if (!enabled || prefersReducedMotion() || typeof navigator === 'undefined' ||
      typeof navigator.vibrate !== 'function') return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;

  const now = Date.now();
  if (now - lastConfirmation < CONFIRM_COOLDOWN_MS) return false;
  try {
    const accepted = navigator.vibrate(CONFIRM_PULSE_MS);
    if (accepted) lastConfirmation = now;
    return accepted;
  } catch {
    // Native feedback is best-effort (e.g. disabled by browser policy); report unavailability.
    return false;
  }
}
