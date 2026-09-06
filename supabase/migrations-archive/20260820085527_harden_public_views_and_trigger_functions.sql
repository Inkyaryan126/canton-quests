-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260820085527
-- Original recorded name:    harden_public_views_and_trigger_functions

alter view public.public_audience_events set (security_invoker = true);
alter view public.public_audience_event_options set (security_invoker = true);
alter view public.public_host_broadcasts set (security_invoker = true);
alter view public.public_quests set (security_invoker = true);
alter view public.public_quest_steps set (security_invoker = true);
alter view public.public_published_drawings_projection set (security_invoker = true);
alter view public.public_drawing_ledger_projection set (security_invoker = true);

revoke execute on function public.check_spectator_vote_limit() from public, anon, authenticated;
revoke execute on function public.fn_prevent_locked_drawing_ledger_edits() from public, anon, authenticated;
revoke execute on function public.fn_prevent_locked_drawing_ledger_locks_edits() from public, anon, authenticated;
revoke execute on function public.prevent_player_role_self_elevation() from public, anon, authenticated;
revoke execute on function public.prevent_player_user_id_tampering() from public, anon, authenticated;
