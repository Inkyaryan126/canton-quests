-- =============================================================================
-- Canton Quests Migration: Critical Player Authentication & Identity Remediation
-- Version: 20260814010000
-- Description: Establishes Supabase Auth (auth.users) as the authoritative
--              identity root for Canton Quests players.
--              Enforces players.user_id cryptographic ownership, safe legacy
--              account claiming, and hardened RLS policies.
-- =============================================================================

-- 1. Ensure unique constraint on user_id for players
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_user_id_unique
  ON public.players(user_id)
  WHERE user_id IS NOT NULL;

-- 2. Index for case-insensitive email lookup during safe legacy account claiming
CREATE INDEX IF NOT EXISTS idx_players_email_lower
  ON public.players(LOWER(email))
  WHERE email IS NOT NULL;

-- 3. Trigger Function: Prevent altering players.user_id once claimed (unless service_role)
CREATE OR REPLACE FUNCTION public.prevent_player_user_id_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (OLD.user_id IS NOT NULL AND NEW.user_id IS NOT NULL AND OLD.user_id <> NEW.user_id) THEN
    IF (auth.jwt() ->> 'role' <> 'service_role') THEN
      RAISE EXCEPTION 'Immutable player ownership: user_id cannot be changed once established.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_player_user_id_tampering ON public.players;
CREATE TRIGGER trg_prevent_player_user_id_tampering
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_player_user_id_tampering();

-- 4. Hardened Row Level Security (RLS) Policies on Players
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own player profile" ON public.players;
CREATE POLICY "Users can insert their own player profile"
  ON public.players
  FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id) OR
    (auth.jwt() ->> 'role' = 'service_role')
  );

DROP POLICY IF EXISTS "Users can update their own player profile" ON public.players;
CREATE POLICY "Users can update their own player profile"
  ON public.players
  FOR UPDATE
  USING (
    (auth.uid() = user_id) OR
    (auth.jwt() ->> 'role' = 'service_role')
  )
  WITH CHECK (
    (auth.uid() = user_id) OR
    (auth.jwt() ->> 'role' = 'service_role')
  );

-- 5. Hardened Quest Submission RLS Policy: Only authenticated player or service_role can submit proofs
ALTER TABLE public.quest_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can create submissions" ON public.quest_submissions;
CREATE POLICY "Players can create submissions"
  ON public.quest_submissions
  FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.players
      WHERE public.players.id = quest_submissions.player_id
        AND public.players.user_id = auth.uid()
    )) OR
    (auth.jwt() ->> 'role' = 'service_role')
  );

-- 6. Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON public.players TO authenticated;
GRANT SELECT ON public.players TO anon;
