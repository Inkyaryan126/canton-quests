# Grid Passport Reconciliation

The canonical Passport is the replayable event-sourced implementation from `grid-passport-read-api-20260918`: immutable `grid_game_events` are source of truth and `grid_player_profiles.passport` is a rebuildable cache.

This reconciliation deliberately discards the parallel direct-JSON mutation design. It ports only the useful additions:
- Home City confirmation appends one idempotent `grid:passport_home_city_set` event and rebuilds the cache.
- Internal city UUID remains server-only; HTTP response stays sanitized.
- Seasonless event idempotency receives a database-enforced partial unique index.
- Existing blank Passport profiles receive replay-compatible Home City events/cache; nonzero legacy reputation gets a matching reputation event.
- Private Passport API responses are `private, no-store` and `Vary: Cookie`.
- Player UI is added only after these canonical persistence rules are green.
