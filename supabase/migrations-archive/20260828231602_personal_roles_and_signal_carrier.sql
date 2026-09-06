-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260828231602
-- Original recorded name:    20260828170000_personal_roles_and_signal_carrier

CREATE TABLE IF NOT EXISTS public.player_personal_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL CHECK (role_type IN ('MESSENGER', 'WITNESS', 'KEYHOLDER', 'SIGNAL_CARRIER')),
    origin TEXT NOT NULL DEFAULT 'SEEDED' CHECK (origin IN ('SEEDED', 'PROPAGATED')),
    propagated_from_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    is_revealed BOOLEAN NOT NULL DEFAULT false,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, player_id, role_type)
);

CREATE INDEX IF NOT EXISTS idx_player_personal_roles_event_player ON public.player_personal_roles(event_id, player_id);
CREATE INDEX IF NOT EXISTS idx_player_personal_roles_signal_carrier ON public.player_personal_roles(event_id) WHERE role_type = 'SIGNAL_CARRIER';

ALTER TABLE public.player_personal_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players read own personal roles" ON public.player_personal_roles;
CREATE POLICY "Players read own personal roles"
  ON public.player_personal_roles
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (SELECT p.id FROM public.players p WHERE p.user_id = (SELECT auth.uid()))
  );
