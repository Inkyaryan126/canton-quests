-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260820085612
-- Original recorded name:    restore_public_projection_view_behavior

alter view public.public_audience_events set (security_invoker = false);
alter view public.public_audience_event_options set (security_invoker = false);
alter view public.public_host_broadcasts set (security_invoker = false);
alter view public.public_quests set (security_invoker = false);
alter view public.public_quest_steps set (security_invoker = false);
alter view public.public_published_drawings_projection set (security_invoker = false);
alter view public.public_drawing_ledger_projection set (security_invoker = false);
