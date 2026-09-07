# Global sound preference

`cqSoundManager` is the single source of truth. Keep using its `play()` / `playEvent()`
methods: they check the preference internally and preserve cooldowns and priorities.
Never instantiate another manager or read/write storage in a component.

React components read `useSoundPreference()` from `@/lib/audio/sound-preference` (or `@/lib/audio`).
It uses `useSyncExternalStore` with a stable boolean snapshot; there is no provider
or duplicate state. The SSR snapshot uses the established sound-on default, then
React reconciles with the browser's persisted preference after hydration.

Imperative code reads `cqSoundManager.isSoundEnabled()` and changes the preference
with `setSoundEnabled(enabled)` or `toggleSound()`. `subscribeSoundPreference()`
is the same manager subscription for non-React consumers; retain its unsubscribe
callback. This is same-document synchronization; cross-tab synchronization is not
introduced here. Existing storage keys, legacy migration, volume, and defaults stay intact.

`SoundToggleControl` demonstrates the hook. Its old `soundEnabled` prop is deprecated
and ignored so a stale game-moment snapshot cannot override the actual preference.
The toggle still updates the legacy game-moment manager when clicked for existing
overlay compatibility. Migrating that manager and other legacy adapters is outside
this checkpoint's write scope.
