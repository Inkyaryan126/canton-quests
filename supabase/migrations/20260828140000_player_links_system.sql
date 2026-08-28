-- Canton Quests — Player-to-Player Link System
-- Migration: 20260828140000_player_links_system.sql
--
-- Event-safe Player Links: a record of two (or, for GROUP_OBJECTIVE, more —
-- represented as multiple pairwise rows sharing a group_id) players meeting
-- in the game, without creating permanent teams. Reuses the existing
-- reward_grants ledger for anti-farming rather than inventing a parallel
-- idempotency mechanism — the same pair can log a link occurrence more than
-- once (a real social interaction can recur), but reward_grants' unique
-- index guarantees the SAME (player, event, link_type, pair) can only ever
-- be paid once.
--
-- No PII lives here: only player_id (already public via the roster) and a
-- link_type/timestamp. No GPS coordinates are stored at all — proximity, if
-- a link type requires it, is validated in the application at the moment of
-- linking and never persisted.

CREATE TABLE IF NOT EXISTS public.player_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL CHECK (link_type IN (
        'PLAYER_LINK', 'DIFFERENT_PATH_LINK', 'GROUP_OBJECTIVE',
        'STRANGER_BONUS', 'TRANSFERABLE_SIGNAL', 'RARE_PAIRING'
    )),
    player_a_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    player_b_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    -- Sorted "playerA:playerB" (lexicographically, computed in application
    -- code) so a lookup for the pair always matches regardless of who
    -- initiated — the reward-idempotency key is built from this, not from
    -- player_a_id/player_b_id directly.
    pair_key TEXT NOT NULL,
    initiated_by_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    -- Non-null only for GROUP_OBJECTIVE — ties every pairwise row from one
    -- 3+-player link event together for aggregate/audit purposes.
    group_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (player_a_id <> player_b_id)
);

CREATE INDEX IF NOT EXISTS idx_player_links_event_pair ON public.player_links(event_id, pair_key);
CREATE INDEX IF NOT EXISTS idx_player_links_event_player_a ON public.player_links(event_id, player_a_id);
CREATE INDEX IF NOT EXISTS idx_player_links_event_player_b ON public.player_links(event_id, player_b_id);
CREATE INDEX IF NOT EXISTS idx_player_links_group ON public.player_links(group_id) WHERE group_id IS NOT NULL;

ALTER TABLE public.player_links ENABLE ROW LEVEL SECURITY;

-- A player may read only links they were personally part of — never the
-- full graph (that would let any player enumerate who's linked with whom
-- city-wide). Aggregate/city-wide stats are exposed only through the safe
-- COUNT-only view below, never row-level access to the ledger itself.
DROP POLICY IF EXISTS "Players read own player links" ON public.player_links;
CREATE POLICY "Players read own player links"
  ON public.player_links
  FOR SELECT
  TO authenticated
  USING (
    player_a_id IN (SELECT p.id FROM public.players p WHERE p.user_id = (SELECT auth.uid()))
    OR player_b_id IN (SELECT p.id FROM public.players p WHERE p.user_id = (SELECT auth.uid()))
  );
-- No INSERT/UPDATE policy — every write goes through supabaseAdmin
-- (lib/player-links-db.ts), after server-side validation (not self, same
-- event, path-difference check for DIFFERENT_PATH_LINK, etc).

-- Safe aggregate-only public projection: total link count per event, no
-- per-player identity exposed at all. Extended further by Mission 3's city
-- state projection.
CREATE OR REPLACE VIEW public.public_player_link_stats
WITH (security_barrier = true) AS
SELECT event_id, COUNT(*)::INTEGER AS total_links
FROM public.player_links
GROUP BY event_id;

GRANT SELECT ON public.public_player_link_stats TO anon, authenticated;

-- Extend reward_grants to allow PLAYER_LINK as a reward reason.
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
    'PLAYER_LINK'
  ));

-- Event-scoped questless-reward idempotency. The existing
-- uq_reward_grants_player_type_key_no_quest index (from
-- 20260825000000_profile_completion_reward.sql) is deliberately NOT
-- event-scoped, because Profile Completion is an account-level, once-ever
-- milestone. Player Links are event-scoped (a player re-entering a future
-- Operation should be able to link again) — every future questless-but-
-- event-scoped reward type can reuse this same index, not just this one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_player_event_type_key_no_quest
  ON public.reward_grants(player_id, event_id, reward_type, reward_key)
  WHERE quest_id IS NULL;
