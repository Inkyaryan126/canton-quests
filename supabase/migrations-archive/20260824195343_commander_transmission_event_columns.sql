-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260824195343
-- Original recorded name:    commander_transmission_event_columns

ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS milestone_transmission JSONB,
  ADD COLUMN IF NOT EXISTS completion_transmission JSONB,
  ADD COLUMN IF NOT EXISTS discovery_transmission JSONB;
