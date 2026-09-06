-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260824182059
-- Original recorded name:    reward_grants_player_quest_idempotency

DROP INDEX IF EXISTS public.uq_reward_grants_submission_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_player_quest_type_key
  ON public.reward_grants(player_id, quest_id, reward_type, reward_key)
  WHERE quest_id IS NOT NULL;
