# Global sound preference

`cqSoundManager` is the source of truth for Canton Quests sound effects. Keep its
existing enabled-by-default behavior, storage keys, legacy mute fallback, sound
map, volume controls, cooldowns, and priority handling.

In a client component, read the reactive preference with:

```tsx
import { useSoundPreference } from '@/lib/audio/use-sound-preference';
const soundEnabled = useSoundPreference();
```

The hook subscribes to the existing singleton with `useSyncExternalStore`; it
does not create another store or require a provider. SSR uses the existing
default (`true`) so hydration is stable, then reconciles the browser's persisted
preference. All mounted consumers update when the manager changes.

In an event handler or non-React browser code, use
`cqSoundManager.isSoundEnabled()`, `setSoundEnabled(enabled)`, or `toggleSound()`.
Use `cqSoundManager.play('ui_confirm')` for effects: playback already checks the
preference, so callers need no duplicate gate or localStorage reads. This does
not control ordinary video/media volume. Persistence remains local to the
browser; live synchronization between separate tabs is not implemented.

`SoundToggleControl` is the integration in the header/navigation and game
overlay. Its old `soundEnabled` prop is accepted but deprecated and ignored:
the overlay's cached state must not override the global manager. The toggle
still updates the legacy `gameMomentManager` on user interaction for existing
consumers. Migration of that manager's independent state is outside this slice.
