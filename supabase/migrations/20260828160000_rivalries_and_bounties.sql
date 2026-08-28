-- Canton Quests — Rivalries & Bounties
-- Migration: 20260828160000_rivalries_and_bounties.sql
--
-- No new table: rivalries are computed live from the existing leaderboard
-- (lib/rivalries.ts) and bounty completion is checked against existing
-- Player Links / leaderboard data (lib/bounties.ts). The only schema
-- change needed is extending reward_grants to allow BOUNTY_COMPLETE as a
-- reward reason — idempotency reuses the same event-scoped questless
-- unique index Player Links and Field NPCs already added
-- (uq_reward_grants_player_event_type_key_no_quest), so a player's bounty
-- status being checked repeatedly (or two concurrent checks) can never
-- grant the same bounty twice.

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
