-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260825213121
-- Original recorded name:    narrow_public_quest_steps_view

CREATE OR REPLACE VIEW public.public_quest_steps
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  qs.id,
  qs.quest_id,
  qs.step_order,
  qs.title,
  qs.instructions,
  qs.verification_type,
  qs.location_id,
  qs.radius_meters,
  qs.created_at
FROM public.quest_steps qs
JOIN public.quests q ON q.id = qs.quest_id
WHERE q.status = 'active';

GRANT SELECT ON public.public_quest_steps TO anon, authenticated;
