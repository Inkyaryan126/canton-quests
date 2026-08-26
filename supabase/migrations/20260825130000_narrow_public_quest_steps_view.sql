-- Canton Quests — Narrow public_quest_steps to Active Quests Only
-- Migration: 20260825130000_narrow_public_quest_steps_view.sql
--
-- Security review of the Supabase-advisor-flagged SECURITY DEFINER-style
-- views (public.public_audience_events, public_audience_event_options,
-- public_host_broadcasts, public_quests, public_quest_steps,
-- public_published_drawings_projection, public_drawing_ledger_projection):
-- all seven are `WITH (security_barrier = true)` views (invoker-mode, no
-- explicit `security_invoker = true`) that exist specifically to expose a
-- sanitized, column-restricted projection of a base table whose RLS is
-- admin-only or policy-less. None of them leak a sensitive column — no
-- secret_codes/quest_steps.target_code, no raw winning_player_id, no
-- session/IP hashes, no unscrubbed PII. Switching any of them to
-- `security_invoker = true` would make anon/authenticated reads run under
-- the *querying* role's own RLS against the admin-only/policy-less base
-- tables and return zero rows, breaking these public projections entirely
-- (that would be a functional regression, not a hardening — see the final
-- report for the full per-view rationale). They are therefore left
-- unchanged in this migration.
--
-- The one real, low-risk tightening identified: unlike public_quests
-- (`WHERE status = 'active'`), public_quest_steps
-- (20260814030000_production_schema_catchup_and_volume1_restore.sql) has no
-- WHERE filter at all — it returns step titles/instructions/locations for
-- every quest_steps row regardless of the parent quest's status, including
-- draft/inactive/secret-not-yet-discovered quests. No secret answer/code is
-- exposed (target_code and accepted_answer_variants are correctly excluded
-- from its SELECT list already), but the existence/location/title of a
-- hidden quest's steps is a real, avoidable content leak. This narrows the
-- view to only the same active-quest set public_quests already exposes —
-- a pure restriction, so it cannot break any client that only ever reads
-- steps for quests it already learned about via public_quests.

CREATE OR REPLACE VIEW public.public_quest_steps
WITH (security_barrier = true) AS
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
