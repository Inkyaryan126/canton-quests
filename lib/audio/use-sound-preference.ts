'use client';

/**
 * Canton Quests — shared sound-preference primitive.
 *
 * `cqSoundManager` (cq-sound-manager.ts) already owns the single source of
 * truth and persistence (localStorage) for whether sound effects are
 * enabled. This file is the ONE supported adapter between that manager and
 * React — it does not track any state of its own. Do not read the
 * `cq_sound_enabled` localStorage key directly, and do not maintain a
 * parallel "soundEnabled" flag elsewhere; always go through
 * `cqSoundManager` (outside React) or `useSoundPreference()` (inside a
 * component) so every reader stays in sync.
 */

import { useEffect, useState } from 'react';
import { cqSoundManager } from './cq-sound-manager';

/** One-off, synchronous read of the current global sound preference. */
export function getSoundPreferenceSnapshot(): boolean {
  return cqSoundManager.isSoundEnabled();
}

/**
 * Subscribes to live changes in the global sound preference. Returns an
 * unsubscribe function. Thin adapter over `cqSoundManager.subscribe`,
 * narrowed to the boolean callers actually need.
 */
export function subscribeSoundPreference(listener: (enabled: boolean) => void): () => void {
  return cqSoundManager.subscribe((state) => listener(state.soundEnabled));
}

export interface SoundPreference {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => boolean;
}

/**
 * The recommended way to read/toggle the global sound preference from any
 * component. Live-updates whenever `cqSoundManager`'s state changes,
 * regardless of which component or code path triggered the change.
 */
export function useSoundPreference(): SoundPreference {
  const [enabled, setEnabled] = useState<boolean>(getSoundPreferenceSnapshot);

  useEffect(() => subscribeSoundPreference(setEnabled), []);

  return {
    enabled,
    setEnabled: (next: boolean) => cqSoundManager.setSoundEnabled(next),
    toggle: () => cqSoundManager.toggleSound(),
  };
}
