-- Canton Quests — Watchers Foundation
-- Migration: 20260828180000_watchers_foundation.sql
--
-- Hidden-layer eligibility architecture only — no Watcher quest content is
-- authored here (the mission explicitly forbids fabricating a final puzzle
-- or fake surveillance; specific clue/quest text is a future content pass).
-- A player may become eligible through more than one independent trigger
-- source, each recorded as its own row (mirrors player_personal_roles'
-- multi-row-per-player shape) — "is this player Watcher-eligible" is
-- simply EXISTS(...) against this table.
--
-- private_clue_state is a free-form JSONB scratch space for future
-- Watcher-specific progress (which clue fragments a player has seen, etc)
-- — the container exists now so content can be added later without a
-- schema change; it starts and stays empty until that content exists.

CREATE TABLE IF NOT EXISTS public.watcher_eligibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    trigger_source TEXT NOT NULL CHECK (trigger_source IN (
        'THREE_SIGILS', 'QUEST_COMBINATION', 'COMPLETION_ORDER', 'HIDDEN_BADGE',
        'PLAYER_INTERACTION', 'NPC_INTERACTION', 'LIVE_EVENT', 'SIGNAL_CARRIER', 'GM_ACTIVATION'
    )),
    trigger_detail TEXT,
    private_clue_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    eligible_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, player_id, trigger_source)
);

CREATE INDEX IF NOT EXISTS idx_watcher_eligibility_event_player ON public.watcher_eligibility(event_id, player_id);

ALTER TABLE public.watcher_eligibility ENABLE ROW LEVEL SECURITY;

-- Strictly own-eyes-only, same pattern as player_personal_roles — a player
-- may confirm their OWN eligibility, never anyone else's. No public or
-- cross-player policy exists.
DROP POLICY IF EXISTS "Players read own watcher eligibility" ON public.watcher_eligibility;
CREATE POLICY "Players read own watcher eligibility"
  ON public.watcher_eligibility
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (SELECT p.id FROM public.players p WHERE p.user_id = (SELECT auth.uid()))
  );
-- No INSERT/UPDATE policy — eligibility is granted exclusively server-side
-- (lib/watchers-db.ts), never by a player action directly.
