-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260828231608
-- Original recorded name:    20260828180000_watchers_foundation

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

DROP POLICY IF EXISTS "Players read own watcher eligibility" ON public.watcher_eligibility;
CREATE POLICY "Players read own watcher eligibility"
  ON public.watcher_eligibility
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (SELECT p.id FROM public.players p WHERE p.user_id = (SELECT auth.uid()))
  );
