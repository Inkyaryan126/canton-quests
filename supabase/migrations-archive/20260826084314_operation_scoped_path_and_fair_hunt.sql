-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260826084314
-- Original recorded name:    operation_scoped_path_and_fair_hunt

-- Canton Quests — Operation-Scoped Path + Activate event_players + Fair QR Hunt
-- Migration: 20260826072300_operation_scoped_path_and_fair_hunt.sql

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS requires_path BOOLEAN NOT NULL DEFAULT false;

UPDATE public.events SET requires_path = true WHERE slug = 'canton-weekend-1';

ALTER TABLE public.event_players
  ADD COLUMN IF NOT EXISTS path TEXT;

DO $$
DECLARE
  v_main_event_id UUID;
BEGIN
  SELECT id INTO v_main_event_id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1;

  IF v_main_event_id IS NOT NULL THEN
    INSERT INTO public.event_players (event_id, player_id, path)
    SELECT v_main_event_id, p.id, p.selected_starting_path
    FROM public.players p
    WHERE p.selected_starting_path IN ('family', 'challenge', 'secret')
      AND (
        EXISTS (
          SELECT 1 FROM public.quest_submissions qs
          WHERE qs.player_id = p.id AND qs.event_id = v_main_event_id
        )
        OR EXISTS (
          SELECT 1 FROM public.score_ledger sl
          WHERE sl.player_id = p.id AND sl.event_id = v_main_event_id
        )
      )
    ON CONFLICT (event_id, player_id) DO UPDATE SET path = EXCLUDED.path
      WHERE public.event_players.path IS NULL;
  END IF;
END $$;

INSERT INTO public.events (
  city_id, title, slug, description, status, current_phase, is_paused,
  start_time, end_time, basic_instructions, safety_notes,
  map_center_lat, map_center_lon, theme_color, requires_path
)
SELECT
  c.id,
  'Canton Quests: Fair QR Hunt',
  'fair-qr-hunt',
  'A path-free QR scavenger hunt across the fairgrounds. Scan every unique QR marker you can find for points toward the $100 Fair QR Hunt prize — no starting path required.',
  'upcoming',
  'day_1',
  false,
  '2026-09-01T04:00:00Z',
  '2026-09-08T03:59:59Z',
  '1. Explore the fairgrounds and find the QR markers.\n2. Scan each one — every unique marker counts once per player.\n3. Track your live rank on the Fair QR Hunt leaderboard.',
  'Stay in public fairground areas, follow posted event staff instructions, and use marked walkways.',
  40.7989,
  -81.3748,
  '#22d3ee',
  false
FROM public.cities c
WHERE c.slug = 'canton-oh'
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_main_event_id UUID;
BEGIN
  SELECT id INTO v_main_event_id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1;

  IF v_main_event_id IS NOT NULL THEN
    INSERT INTO public.reward_grants (event_id, player_id, reward_type, reward_key, xp_awarded, drawing_entries_awarded)
    SELECT
      v_main_event_id,
      p.id,
      'PROFILE_COMPLETION',
      'profile_identity_complete',
      0,
      0
    FROM public.players p
    WHERE (
        p.avatar_preset_key IN ('1', '2', '3', '4', '5', '6', '7', '8')
        OR (p.avatar_preset_key = 'custom' AND p.profile_image_path IS NOT NULL)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.reward_grants rg
        WHERE rg.player_id = p.id
          AND rg.reward_type = 'PROFILE_COMPLETION'
          AND rg.reward_key = 'profile_identity_complete'
          AND rg.quest_id IS NULL
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
