-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260825213116
-- Original recorded name:    lock_down_reward_rpcs

REVOKE EXECUTE ON FUNCTION public.claim_quest_placement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quest_placement(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_drawing_entries(uuid, uuid, uuid, integer, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_drawing_entries(uuid, uuid, uuid, integer, uuid, text, text) TO service_role;

ALTER FUNCTION public.validate_player_featured_badges() SET search_path = public;
