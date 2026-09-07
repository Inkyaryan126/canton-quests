'use client';

import { useSyncExternalStore } from 'react';
import { cqSoundManager } from './cq-sound-manager';

/** Boolean snapshots stay stable; the manager remains the only preference store. */
export const getSoundPreference = (): boolean => cqSoundManager.isSoundEnabled();
export const subscribeSoundPreference = (onChange: () => void): (() => void) =>
  cqSoundManager.subscribe(onChange);

// Match the established default on the server and during hydration.
const getServerSoundPreference = (): boolean => true;

/** Reactive global preference. Playback still goes through cqSoundManager.play(). */
export function useSoundPreference(): boolean {
  return useSyncExternalStore(
    subscribeSoundPreference,
    getSoundPreference,
    getServerSoundPreference,
  );
}
