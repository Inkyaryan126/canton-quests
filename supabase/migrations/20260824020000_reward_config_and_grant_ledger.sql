-- Canton Quests — Reward Template Config + Reward Grant Ledger
-- Migration: 20260824020000_reward_config_and_grant_ledger.sql
--
-- Wires the reusable QuestRewardConfig template (lib/types.ts, lib/quest-rewards.ts)
-- into the real award-granting transaction:
--   1. quests.reward_config — the JSONB template, previously only read by the
--      local in-memory engine's SEED_QUESTS catalog and never persisted for
--      real Supabase-backed quests.
--   2. reward_grants — a per-component audit + idempotency ledger. One row
--      per distinct reward a submission produces (base XP, each eligible
--      bonus, race tier, badge, collectible, secret unlock, Three Locks
--      fragment, finale progress), so every award is traceable and a
--      retried/duplicated request cannot grant the same component twice.
--      score_ledger keeps writing a single combined-points row per quest
--      completion exactly as it does today (existing leaderboard math and
--      the partial unique index on score_ledger are untouched); reward_grants
--      is the new, additional source of per-reason auditability.
--   3. claim_quest_placement(uuid) — a narrowly-scoped RPC that atomically
--      increments quests.current_claims and returns the new value, used to
--      determine race-bonus placement server-side under concurrent
--      completions without a read-then-write race condition.

-- 1. Reward config template column on quests
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS reward_config JSONB;

-- 2. Reward grant ledger
CREATE TABLE IF NOT EXISTS public.reward_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    quest_id UUID REFERENCES public.quests(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES public.quest_submissions(id) ON DELETE SET NULL,
    reward_type TEXT NOT NULL CHECK (reward_type IN (
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
        'FINALE_PROGRESS'
    )),
    reward_key TEXT NOT NULL,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    drawing_entries_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The core idempotency guarantee: the same specific reward can never be
-- granted twice to the same player for the same quest — scoped by
-- player+quest (not submission), so a quest with rewardConfig.remoteCapable
-- content that legitimately receives more than one submission (a remote
-- completion, then a later field check-in, then a field photo) can still
-- only ever be granted each distinct component once. Scoped to quest_id IS
-- NOT NULL so ad-hoc/GM grants with no quest context aren't constrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_player_quest_type_key
  ON public.reward_grants(player_id, quest_id, reward_type, reward_key)
  WHERE quest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reward_grants_player ON public.reward_grants(player_id, event_id);
CREATE INDEX IF NOT EXISTS idx_reward_grants_quest ON public.reward_grants(quest_id);

ALTER TABLE public.reward_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reward grants viewable by everyone" ON public.reward_grants;
CREATE POLICY "Reward grants viewable by everyone" ON public.reward_grants FOR SELECT USING (true);

-- 3. Atomic race-placement claim
CREATE OR REPLACE FUNCTION public.claim_quest_placement(p_quest_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims INTEGER;
BEGIN
  UPDATE public.quests
  SET current_claims = COALESCE(current_claims, 0) + 1
  WHERE id = p_quest_id
  RETURNING current_claims INTO v_claims;

  RETURN v_claims;
END;
$$;
