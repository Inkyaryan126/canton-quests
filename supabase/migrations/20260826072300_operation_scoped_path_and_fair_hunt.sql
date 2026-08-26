-- Canton Quests — Operation-Scoped Path + Activate event_players + Fair QR Hunt
-- Migration: 20260826072300_operation_scoped_path_and_fair_hunt.sql
--
-- Reorganizes the player flow so path selection belongs to the specific
-- Operation that uses it (the Sept 11 Main Operation), not to the player's
-- permanent account. Fully additive — no column is dropped, no existing
-- value is discarded, no NOT NULL/CHECK constraint is added anywhere.
--
-- 1. events.requires_path — lets each Operation declare whether it uses a
--    path at all. Nullable-safe default false so any Operation created
--    without setting it explicitly (including local/offline seed data)
--    stays path-free rather than unexpectedly gating.
-- 2. event_players.path — activates the previously-unused event_players
--    table (created in 20260809000000_phase1_playable_core.sql, never
--    written to by any application code before this migration) as the
--    canonical Operation-participation record, per the approved
--    architecture. Nullable: an Operation that doesn't use paths simply
--    never sets it.
-- 3. Backfill: for the existing Sept 11 Main Operation only, create
--    event_players rows for players with LEGITIMATE participation
--    (an existing quest_submissions or score_ledger row for that event —
--    never "every player who ever registered an account"), copying their
--    current players.selected_starting_path into event_players.path.
--    players.selected_starting_path itself is left completely untouched —
--    it remains in place as legacy/safety data, per the approved decision
--    not to destroy it.
-- 4. Seeds the Fair QR Hunt as a real second events row (idempotent via the
--    existing UNIQUE(slug) constraint) — a genuine Operation, not a
--    marketing funnel into Volume 1. requires_path = false.
-- 5. Grandfathers the relaxed Player Identity completion reward: the
--    application code (lib/player-command-center.ts, this same PR) stops
--    requiring a path for the account-level +100 XP identity-completion
--    reward, requiring only a valid avatar. Mirroring the precedent set by
--    20260825000000_profile_completion_reward.sql (which grandfathered
--    already-qualifying players in at 0 XP so the reward's introduction
--    didn't retroactively pay out), this step grandfathers in any player
--    who newly qualifies under the RELAXED (avatar-only) rule but who
--    doesn't already hold a reward_grants row for it — at 0 XP, so
--    relaxing the requirement doesn't trigger a surprise mass XP payout on
--    every affected player's next profile save. Genuinely new players who
--    complete their identity from this point forward still earn the live
--    +100 XP via the application, exactly as before. The existing
--    reward_grants unique index (player_id, reward_type, reward_key) WHERE
--    quest_id IS NULL is the idempotency guarantee — this migration cannot
--    create a duplicate grant for anyone, and ON CONFLICT DO NOTHING makes
--    the whole migration safely re-runnable.

-- 1. Operation-level path requirement flag
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS requires_path BOOLEAN NOT NULL DEFAULT false;

UPDATE public.events SET requires_path = true WHERE slug = 'canton-weekend-1';

-- 2. Operation-specific path on the participation record
ALTER TABLE public.event_players
  ADD COLUMN IF NOT EXISTS path TEXT;

-- 3. Backfill event_players for existing Sept 11 participants only —
-- determined by real activity (quest_submissions or score_ledger), never by
-- account existence alone.
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

-- 4. Seed the Fair QR Hunt as a real, independent Operation.
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

-- 5. Grandfather players who newly qualify for Player Identity completion
-- under the relaxed (avatar-only) rule, at 0 XP — see rationale above.
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
