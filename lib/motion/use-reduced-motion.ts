'use client';

import { useSyncExternalStore } from 'react';
import { prefersReducedMotion, subscribeReducedMotion } from './reduced-motion';

const getServerSnapshot = () => true;

/** Use for native/JS effects only; use the CSS primitives for visual transitions. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, getServerSnapshot);
}
