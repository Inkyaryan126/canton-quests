'use client';

import { useSyncExternalStore } from 'react';

/**
 * Canton Quests — field-equipment motion primitives.
 *
 * CSS is the source of truth for timing (see the `.cq-motion-*` tokens and
 * `.cq-transition-*` classes in app/globals.css). This module only exposes
 * the small bits that must run in JS: reading the live OS preference and an
 * optional haptic confirmation pulse.
 */

/** Reads the OS preference on demand so a live change is always honored. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

/** Reactive OS reduced-motion preference, kept in sync with live changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => true);
}

const CONFIRMATION_PULSE_MS = 12;

/**
 * Best-effort confirmation pulse for a key confirmation only. Opt-in and
 * feature-detected: never call this to gate or await gameplay outcomes.
 */
export function confirmHaptic({ enabled = false }: { enabled?: boolean } = {}): boolean {
  if (!enabled || prefersReducedMotion() || typeof navigator === 'undefined') return false;
  try {
    if (typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(CONFIRMATION_PULSE_MS);
  } catch {
    return false;
  }
}
