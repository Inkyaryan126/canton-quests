-- Canton Quests — Founder's Cipher Convergence / Master Finale
-- Migration: 20260828190000_founders_cipher_finale.sql
--
-- Sigil state (1/2/3 districts unlocked) already exists —
-- player_district_cipher_progress, from the district-fragment migration —
-- and is not touched here. This adds only what's missing: a GM-configured
-- finale definition (one row per event) and per-player finale progress.
--
-- final_answer_hash / false_finale_answer_hash follow the exact
-- 'sha256:<hex>' convention lib/quest-proof-secrets.ts's proofMatches
-- already validates against — reusing that comparison function rather
-- than inventing a second hashing scheme. Both columns are nullable and
-- start NULL: an unconfigured finale has no answer to guess, which is the
-- safe default — never a placeholder/fake answer to "finish
-- implementation." Neither hash, nor the clue pieces before eligibility,
-- is ever selectable by anon/authenticated roles (RLS below has zero
-- SELECT policy on finale_config at all — every read goes through
-- supabaseAdmin, server-side, in lib/finale-db.ts, which decides exactly
-- what a given player is allowed to see).

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

-- finale_config: zero SELECT policy at all, even for the config's non-secret
-- fields — the answer hashes live on the same row, and the whole point is
-- that no client-side Supabase query can ever touch this table. Every
-- legitimate read (clue pieces once eligible, destination reveal once
-- completed) goes through a server route that decides field-by-field what
-- to expose, never a passthrough of the row.
DROP POLICY IF EXISTS "Finale config is server-only" ON public.finale_config;

-- Players may read their OWN progress row (attempts count, whether they've
-- passed the false finale, whether they've completed it) — never anyone
-- else's, and this row never contains the answer or clue text itself.
DROP POLICY IF EXISTS "Players read own finale progress" ON public.player_finale_progress;
CREATE POLICY "Players read own finale progress"
  ON public.player_finale_progress
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (SELECT p.id FROM public.players p WHERE p.user_id = (SELECT auth.uid()))
  );
-- No INSERT/UPDATE policy on either table — all writes are server-side
-- (lib/finale-db.ts), including finale_config (GM-authored via the admin
-- API), never a direct player write.
