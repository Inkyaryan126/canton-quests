-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260828231615
-- Original recorded name:    20260828190000_founders_cipher_finale

CREATE TABLE IF NOT EXISTS public.finale_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
    required_sigil_count INTEGER NOT NULL DEFAULT 3,
    requires_watcher_eligibility BOOLEAN NOT NULL DEFAULT false,
    master_cipher_clue_pieces TEXT[] NOT NULL DEFAULT '{}',
    final_answer_hash TEXT,
    final_destination_reveal TEXT,
    opens_at TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    false_finale_enabled BOOLEAN NOT NULL DEFAULT false,
    false_finale_answer_hash TEXT,
    false_finale_reveal_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at),
    CHECK (required_sigil_count >= 1 AND required_sigil_count <= 3)
);

CREATE TABLE IF NOT EXISTS public.player_finale_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    false_finale_solved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_finale_progress_event ON public.player_finale_progress(event_id);

ALTER TABLE public.finale_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_finale_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finale config is server-only" ON public.finale_config;

DROP POLICY IF EXISTS "Players read own finale progress" ON public.player_finale_progress;
CREATE POLICY "Players read own finale progress"
  ON public.player_finale_progress
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (SELECT p.id FROM public.players p WHERE p.user_id = (SELECT auth.uid()))
  );
