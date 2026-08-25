-- Canton Quests — Profile Completion Incentive
-- Migration: 20260825000000_profile_completion_reward.sql
--
-- Adds a one-time, account-level "Player Identity" onboarding reward
-- (+100 XP, no Entry Token) that fires the first time a player has BOTH a
-- valid starting district AND a valid avatar (preset or uploaded custom).
-- Account signup alone stays worth 0 XP.
--
-- 1. reward_grants.reward_type CHECK — extended to allow 'PROFILE_COMPLETION'
--    alongside the existing quest-scoped reward reasons.
-- 2. A new partial unique index protecting questless grants (quest_id IS
--    NULL), scoped by (player_id, reward_type, reward_key) — the existing
--    uq_reward_grants_player_quest_type_key index only covers quest_id IS
--    NOT NULL rows, so without this a questless reward like this one could
--    be inserted more than once for the same player. This is the DB-level
--    idempotency guarantee: at most one
--    (player_id, 'PROFILE_COMPLETION', 'profile_identity_complete') row
--    can ever exist.
-- 3. A one-time, explicit backfill: any player who ALREADY satisfies both
--    identity requirements as of this migration is grandfathered in with a
--    zero-XP reward_grants row (marks the reward "already claimed" without
--    retroactively paying out +100 XP to existing players). Only players
--    who newly complete their identity from this point forward receive the
--    live +100 XP grant via the application (evaluateAndGrantProfileCompletionRewardDB
--    in lib/supabase-db.ts). No players.total_xp values are modified by
--    this migration — only the reward_grants ledger is backfilled.

-- 1. Extend reward_type CHECK to allow the new account-level reward reason
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

-- 2. Idempotency guarantee for questless (account-level) reward grants.
-- Deliberately excludes event_id from the uniqueness key: Player Identity
-- completion is an account-level milestone, not an event-scoped one — a
-- player should be able to earn it at most once ever, not once per event.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_player_type_key_no_quest
  ON public.reward_grants(player_id, reward_type, reward_key)
  WHERE quest_id IS NULL;

-- 3. Grandfather existing qualifying players — mark the reward as already
-- claimed (xp_awarded = 0) for any player who, at the time this migration
-- runs, already has BOTH a valid starting path and a valid avatar. This
-- prevents every already-qualifying production account from suddenly
-- receiving +100 XP the next time their profile is saved, while still
-- letting genuinely new completions (path or avatar chosen from this point
-- forward) earn the live reward through the application.
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
