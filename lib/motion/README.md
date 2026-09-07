# Motion Primitives (`lib/motion`)

Field-equipment motion tokens and utilities for Canton Quests.

## Design Principles
- **CSS is the source of truth**: Durations, easings, and transitions live in `app/globals.css` as `--cq-motion-*` properties and `.cq-transition-*` classes.
- **No animation runtime**: No JS timers or bulky motion dependencies.
- **Accessibility first**: `prefers-reduced-motion` collapses all transition tokens to `0ms` and suppresses transforms.
- **Sparing haptics**: `confirmHaptic()` provides an optional, non-blocking confirmation pulse via `navigator.vibrate` when explicitly enabled.
