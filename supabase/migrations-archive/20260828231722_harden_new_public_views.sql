-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260828231722
-- Original recorded name:    20260828202000_harden_new_public_views

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_live_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_field_npcs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_player_link_stats FROM anon, authenticated;
GRANT SELECT ON public.public_live_events TO anon, authenticated;
GRANT SELECT ON public.public_field_npcs TO anon, authenticated;
GRANT SELECT ON public.public_player_link_stats TO anon, authenticated;
