-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260826121519
-- Original recorded name:    fair_qr_hunt_verified_claim_uniqueness

CREATE UNIQUE INDEX IF NOT EXISTS uq_quest_submissions_player_quest_verified
  ON public.quest_submissions(player_id, quest_id)
  WHERE status = 'verified';
