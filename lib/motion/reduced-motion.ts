'use client';

/**
 * Canton Quests — shared prefers-reduced-motion primitive.
 *
 * This is the ONE place that reads the OS/browser reduced-motion setting.
 * Do not add a new `window.matchMedia('(prefers-reduced-motion: reduce)')`
 * check anywhere else — call `prefersReducedMotion()` for a one-off read,
 * `subscribeToReducedMotionChange()` for live updates outside React, or the
 * `useReducedMotion()` hook inside a component.
 *
 * All three are SSR-safe: with no `window`/`matchMedia` support they resolve
 * to "motion is fine" (false) rather than throwing.
 */

import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY);
  } catch {
    return null;
  }
}

/** One-off, synchronous read of the current reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  const mql = getMediaQueryList();
  return mql ? mql.matches : false;
}

/**
 * Subscribes to live changes in the reduced-motion preference (e.g. the user
 * flips the OS setting while the tab stays open). Returns an unsubscribe
 * function; safe to call with no matchMedia support, resolving to a no-op.
 */
export function subscribeToReducedMotionChange(listener: (matches: boolean) => void): () => void {
  const mql = getMediaQueryList();
  if (!mql) {
    return () => {};
  }

  const handler = (event: MediaQueryListEvent) => listener(event.matches);

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }

  // Safari < 14 fallback (deprecated but still present in lib.dom types).
  mql.addListener(handler);
  return () => mql.removeListener(handler);
}

/**
 * React hook wrapper — the recommended way to read live reduced-motion
 * state inside a component when a CSS-only solution
 * (`primitives.module.css`'s `@media (prefers-reduced-motion: reduce)`
 * block) isn't enough, e.g. to skip a JS-driven effect entirely.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    setReduced(prefersReducedMotion());
    return subscribeToReducedMotionChange(setReduced);
  }, []);

  return reduced;
}
