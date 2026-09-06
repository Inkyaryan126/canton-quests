-- Canton Quests — Harden new public views
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations, version 20260828231722, recorded
-- name "20260828202000_harden_new_public_views") — this file did not
-- previously exist in the repo; the change was applied directly to
-- production without ever being committed. Added here so a fresh
-- environment reconstruction matches production exactly. Locks the three
-- newer public projection views down to read-only for anon/authenticated,
-- matching the same pattern already used elsewhere for public views.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_live_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_field_npcs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.public_player_link_stats FROM anon, authenticated;
GRANT SELECT ON public.public_live_events TO anon, authenticated;
GRANT SELECT ON public.public_field_npcs TO anon, authenticated;
GRANT SELECT ON public.public_player_link_stats TO anon, authenticated;
