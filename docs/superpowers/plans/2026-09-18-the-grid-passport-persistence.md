# Grid Passport City Entry Persistence

## Goal

Persist permanent city-entry history behind one atomic server-authoritative command using the existing `grid_player_profiles.passport` JSON and immutable Grid event ledger.

## Rules

- Home City must already be confirmed.
- City identity must exist in `grid_cities`.
- Every command carries a server-generated/controlled idempotency key and timestamp.
- The player profile row is locked before replay detection and mutation so concurrent entries cannot lose counts.
- Exact retries return the existing Passport/event without incrementing entry counts.
- Reusing an idempotency key for another player/city/event fails closed.
- Passport stamps remain compact: first entry, last entry, entry count, Home City marker.
- `grid:passport_city_entered` is appended to the immutable event ledger.
- Credits, Influence, Command Points, seasonal ownership, and local economy state are never read or mutated by this command.

No public player API is added in this slice; wiring city-entry commands to future multi-city navigation gets a separate authenticated integration checkpoint.
