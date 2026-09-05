-- Canton Quests — XP System Expansion
-- ================================================================
-- Adds four new reward_grants reward_type values for the Sept 11 Main
-- Operation XP expansion: PROFILE_MILESTONE (granular one-time profile
-- development steps beyond the existing avatar-only PROFILE_COMPLETION),
-- SOCIAL_SHARE (daily honor-system share-to-social XP, one-per-day via a
-- date-suffixed reward_key against the existing questless account-level
-- unique index), DAILY_LUCKY_SIGNAL (same daily-claim pattern, a random
-- XP pickup), and QUEST_LUCKY_BONUS (a per-submission surprise XP bonus,
-- quest-scoped, using the existing quest-scoped unique index). No new
-- unique index is needed for any of these — they reuse the three existing
-- partial unique indexes on reward_grants exactly as documented in
-- 20260828140000_player_links_system.sql.
--
-- Also adds optional reward_xp_min/reward_xp_max to field_npcs so an NPC
-- can be configured to pay a random amount in a range instead of a flat
-- reward_xp — nullable, additive, existing NPCs are unaffected until an
-- admin sets a range.

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
    'BOUNTY_COMPLETE',
    'PROFILE_MILESTONE',
    'SOCIAL_SHARE',
    'DAILY_LUCKY_SIGNAL',
    'QUEST_LUCKY_BONUS'
  ));

ALTER TABLE public.field_npcs
  ADD COLUMN IF NOT EXISTS reward_xp_min INTEGER,
  ADD COLUMN IF NOT EXISTS reward_xp_max INTEGER;

ALTER TABLE public.field_npcs
  ADD CONSTRAINT field_npcs_reward_xp_range_check
    CHECK (
      (reward_xp_min IS NULL AND reward_xp_max IS NULL)
      OR (reward_xp_min IS NOT NULL AND reward_xp_max IS NOT NULL AND reward_xp_min >= 0 AND reward_xp_max >= reward_xp_min)
    );
