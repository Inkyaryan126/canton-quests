'use client';

import { useSyncExternalStore } from 'react';
import { cqSoundManager } from './cq-sound-manager';

const subscribe = (notify: () => void) => cqSoundManager.subscribe(() => notify());
const getSnapshot = () => cqSoundManager.isSoundEnabled();
// Match the manager's existing default during SSR; React reconciles storage after hydration.
const getServerSnapshot = () => true;

/** Reactive view of the existing singleton, never a second preference store. */
export function useSoundPreference(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
