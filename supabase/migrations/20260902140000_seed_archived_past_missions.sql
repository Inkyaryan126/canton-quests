-- Canton Quests — Seed two archived/completed past Missions
-- Migration: 20260902140000_seed_archived_past_missions.sql
--
-- Pure worldbuilding/continuity seed: two events rows dated before the
-- current September 2026 Missions, both status='ended', so the public
-- Mission Directory (app/events/page.tsx) has real history to show before
-- Founder's Cipher and the Fair QR Hunt launch. Fully additive — no
-- existing event, quest, or column is touched.
--
-- Neither Mission gets any quests, QR codes, submissions, claims, or
-- players — there is no gameplay behind them, only the event row itself
-- (title/dates/status/description) plus small static frontend copy
-- (components/OperationCard.tsx, app/events/archive/[slug]/page.tsx) for
-- the "MISSION COMPLETE" archive/debrief presentation. No player
-- participation stats, winners, prize payouts, or testimonials are
-- fabricated anywhere — there is nothing in either row that claims any of
-- that happened.
--
-- city_id resolved by slug (not hardcoded), same pattern as the Fair QR
-- Hunt's own seed in 20260826072300_operation_scoped_path_and_fair_hunt.sql.
-- Idempotent via the existing UNIQUE(slug) constraint on public.events.

INSERT INTO public.events (
  city_id, title, slug, description, status, current_phase, is_paused,
  start_time, end_time, basic_instructions, theme_color, requires_path,
  created_at
)
SELECT
  c.id,
  'The Missing Signal',
  'the-missing-signal',
  'A strange transmission surfaced across Canton. Players were called to follow hidden marks, broken signals, and overlooked details scattered through the city to trace the origin of a message that was never meant to be found.',
  'ended',
  'day_1',
  false,
  '2026-06-19T04:00:00Z',
  '2026-06-22T03:59:59Z',
  'This Mission has concluded. See the archive for the final debrief.',
  '#6b7280',
  false,
  '2026-06-19T00:00:00Z'
FROM public.cities c
WHERE c.slug = 'canton-oh'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.events (
  city_id, title, slug, description, status, current_phase, is_paused,
  start_time, end_time, basic_instructions, theme_color, requires_path,
  created_at
)
SELECT
  c.id,
  'The Midnight Ledger',
  'the-midnight-ledger',
  'A coded ledger appeared with references to Canton landmarks, unexplained times, and locations that should not have been connected. Following the entries revealed that someone else had been watching the city long before the players arrived.',
  'ended',
  'day_1',
  false,
  '2026-08-01T04:00:00Z',
  '2026-08-04T03:59:59Z',
  'This Mission has concluded. See the archive for the final debrief.',
  '#4c1d95',
  false,
  '2026-08-01T00:00:00Z'
FROM public.cities c
WHERE c.slug = 'canton-oh'
ON CONFLICT (slug) DO NOTHING;
