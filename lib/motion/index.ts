export * from './tokens';

/** Match the CSS primitive's media query; read on demand so OS changes are honored. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const CONFIRMATION_PULSE_MS = 12;

/** Best-effort confirmation only. Call directly from a gesture, with explicit opt-in. */
export function confirmHaptic({ enabled = false }: { enabled?: boolean } = {}): boolean {
  if (!enabled || prefersReducedMotion() || typeof navigator === 'undefined') return false;
  try {
    if (typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(CONFIRMATION_PULSE_MS);
  } catch {
    // Vibration is optional; browser policy must never interrupt the action.
    return false;
  }
}
