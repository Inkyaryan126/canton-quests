-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260828231556
-- Original recorded name:    20260828160000_rivalries_and_bounties

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
    'PROFILE_COMPLETION',
    'PLAYER_LINK',
    'NPC_CLAIM',
    'BOUNTY_COMPLETE'
  ));
