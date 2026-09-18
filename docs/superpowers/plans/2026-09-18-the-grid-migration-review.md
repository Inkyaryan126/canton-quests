# Grid Production Migration Review Gate

## Goal

Turn the launch-hardening migration review into a repeatable static gate instead of a manual pre-launch memory test.

## Rules enforced

- Grid migration filenames use a 14-digit version and `grid_` namespace.
- A Grid migration version may not collide with any other Supabase migration version.
- Grid foundation exists and remains the earliest Grid migration.
- Every `SECURITY DEFINER` Grid function pins `search_path`, revokes `PUBLIC`, `anon`, and `authenticated`, and grants execution to `service_role`.
- Grid migrations may append to `grid_game_events` but may not directly update, delete, or truncate ledger history.
- Grid migrations may not drop/disable the event-ledger mutation trigger or drop its rejection function.

The checker is intentionally static and conservative. It complements local Supabase migration execution and integration tests; it does not replace them.
