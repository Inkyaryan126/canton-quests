# Audio Subsystem (`lib/audio`)

Centralized audio management for Canton Quests.

## Modules
- `cq-sound-manager.ts`: Audio singleton managing playback, state, and event subscriptions.
- `cq-sound-map.ts`: Audio assets, sound effects, volume profiles, and cooldowns.
- `sound-preference.ts`: Reactive `useSoundPreference()` hook using `useSyncExternalStore` for uniform global sound preference tracking across components.
