-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260824164612
-- Original recorded name:    reward_config_and_grant_ledger

ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS reward_config JSONB;

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

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_submission_type_key
  ON public.reward_grants(submission_id, reward_type, reward_key)
  WHERE submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reward_grants_player ON public.reward_grants(player_id, event_id);
CREATE INDEX IF NOT EXISTS idx_reward_grants_quest ON public.reward_grants(quest_id);

ALTER TABLE public.reward_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reward grants viewable by everyone" ON public.reward_grants;
CREATE POLICY "Reward grants viewable by everyone" ON public.reward_grants FOR SELECT USING (true);

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
