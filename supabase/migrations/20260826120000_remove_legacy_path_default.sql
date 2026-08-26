-- Canton Quests — Remove the misleading global default on players.selected_starting_path
-- Migration: 20260826120000_remove_legacy_path_default.sql
--
-- players.selected_starting_path has carried DEFAULT 'family' since it was
-- introduced (20260814000000_player_identity_three_path_architecture.sql,
-- reasserted in 20260814030000_production_schema_catchup_and_volume1_restore.sql).
-- That default predates the Command Center / Operations reorganization
-- (20260826072300_operation_scoped_path_and_fair_hunt.sql), where path
-- became Operation-specific and lives on event_players.path instead. With
-- the DB default still in place, a brand-new player who has never entered
-- any Operation and never chosen a path is silently assigned 'family' at
-- insert time — a fabricated global identity, not a real choice.
--
-- This migration only removes the column default for future inserts. It is
-- fully additive/non-destructive:
--   - the column stays nullable (no NOT NULL added)
--   - no existing row is read, updated, or backfilled
--   - existing 'family' / 'challenge' / 'secret' values are left exactly as
--     they are (legacy data, per the standing decision not to destroy it)
--   - event_players.path is untouched
--   - the column itself is not dropped
--
-- A new player row inserted after this migration gets
-- selected_starting_path = NULL unless the insert explicitly supplies a
-- value, instead of silently inheriting 'family'.

ALTER TABLE public.players
  ALTER COLUMN selected_starting_path DROP DEFAULT;
