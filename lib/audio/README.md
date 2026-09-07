# lib/audio — Tactical Audio System

- `cq-sound-map.ts` — asset paths, per-event volume/cooldown/priority config.
- `cq-sound-manager.ts` — the `CQSoundManager` singleton (`cqSoundManager`).
  Owns playback, the mute/volume preference, and its `localStorage`
  persistence (`cq_sound_enabled`, `cq_sound_volume`).
- `use-sound-preference.ts` — the shared sound-preference primitive (below).

## Checking/respecting the global sound preference

There is **one** documented way to do this, and it reuses `cqSoundManager`
rather than duplicating its state or storage:

- **Outside React** (utility code, non-component modules): call
  `cqSoundManager.isSoundEnabled()`, `.setSoundEnabled()`, `.toggleSound()`,
  or `.subscribe()` directly.
- **Inside a React component**: use `useSoundPreference()`:

```tsx
import { useSoundPreference } from '@/lib/audio';

function MyControl() {
  const { enabled, toggle } = useSoundPreference();
  return <button onClick={toggle}>{enabled ? 'Mute' : 'Unmute'}</button>;
}
```

`useSoundPreference()` subscribes to `cqSoundManager` and re-renders on any
change, from any source — it does not track its own copy of the flag. Do
not read the `cq_sound_enabled` localStorage key directly, and do not add a
second "soundEnabled" flag anywhere else in the app; every reader must go
through this manager so toggling sound in one place (e.g. the header
toggle) is instantly reflected everywhere else.

`components/game-effects/SoundToggleControl.tsx` is the reference call
site for this hook.
