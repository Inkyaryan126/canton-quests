-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260826121524
-- Original recorded name:    fair_qr_placement_deployment_fields

ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS placement_details JSONB,
  ADD COLUMN IF NOT EXISTS placed_at TIMESTAMPTZ;
