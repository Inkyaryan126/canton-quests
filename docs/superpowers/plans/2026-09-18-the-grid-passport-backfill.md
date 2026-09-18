# Grid Passport Existing Home City Backfill

## Goal

Players who confirmed Home City before Passport integration should start with the same single permanent Home City stamp as players confirming afterward.

## Rules

- Only profiles with a non-null Home City and exactly empty `{}` Passport state are backfilled.
- The pre-existing profile `updated_at` is preserved and reused as the best available Home City confirmation timestamp; the migration does not rewrite it.
- The stamp contains one city, one entry, and `isHomeCity=true`.
- An immutable `grid:passport_city_entered` event is appended with `backfilled=true`.
- The event uses exactly the same deterministic `passport:home-city:{player}:{city}` idempotency key as the live Home City route.
- If that event already exists, the migration does not create a duplicate event.
- Seasonal economy state is never read or mutated.
