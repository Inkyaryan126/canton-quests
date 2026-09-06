-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260825030456
-- Original recorded name:    profile_completion_reward

ALTER TABLE public.reward_grants
  DROP CONSTRAINT IF EXISTS reward_grants_reward_type_check;

ALTER TABLE public.reward_grants
  ADD CONSTRAINT reward_grants_reward_type_check CHECK (reward_type IN (
    'QUEST_BASE',
    'QUEST_FIELD_CHECKIN',
    'QUEST_NFC',
    'QUEST_PHOTO_VIDEO',
    'QUEST_RACE_BONUS',
    'QUEST_DRAWING_ENTRY_BONUS',
    'BADGE_UNLOCK',
    'COLLECTIBLE_UNLOCK',
    'SECRET_UNLOCK',
    'THREE_LOCKS_FRAGMENT',
    'FINALE_PROGRESS',
    'PROFILE_COMPLETION'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_player_type_key_no_quest
  ON public.reward_grants(player_id, reward_type, reward_key)
  WHERE quest_id IS NULL;

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id FROM public.events WHERE slug = 'canton-weekend-1' LIMIT 1;
  IF v_event_id IS NOT NULL THEN
    INSERT INTO public.reward_grants (event_id, player_id, reward_type, reward_key, xp_awarded, drawing_entries_awarded)
    SELECT
      v_event_id,
      p.id,
      'PROFILE_COMPLETION',
      'profile_identity_complete',
      0,
      0
    FROM public.players p
    WHERE p.selected_starting_path IN ('family', 'challenge', 'secret')
      AND (
        p.avatar_preset_key IN ('1', '2', '3', '4', '5', '6', '7', '8')
        OR (p.avatar_preset_key = 'custom' AND p.profile_image_path IS NOT NULL)
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
