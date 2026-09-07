'use client';

import { useSyncExternalStore } from 'react';
import { prefersReducedMotion } from './index';

const serverSnapshot = () => true;
function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** CSS handles transitions; this hook prevents mounting cosmetic JS work. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, serverSnapshot);
}
