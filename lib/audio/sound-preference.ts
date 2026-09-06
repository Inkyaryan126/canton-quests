'use client';

import { useSyncExternalStore } from 'react';
import { cqSoundManager } from './cq-sound-manager';

/**
 * The single reusable way for a component to read the global sound
 * preference. `cqSoundManager` stays the only store — this just exposes it
 * through `useSyncExternalStore` so components re-render on change without
 * their own subscribe/useState wiring.
 */
export const getSoundPreference = (): boolean => cqSoundManager.isSoundEnabled();

export const subscribeSoundPreference = (onChange: () => void): (() => void) =>
  cqSoundManager.subscribe(onChange);

// Matches the manager's own default so SSR markup and the first client
// render agree; the real persisted value applies right after hydration.
const getServerSoundPreference = (): boolean => true;

export function useSoundPreference(): boolean {
  return useSyncExternalStore(
    subscribeSoundPreference,
    getSoundPreference,
    getServerSoundPreference,
  );
}
