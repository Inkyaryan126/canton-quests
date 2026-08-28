-- Canton Quests — Personal Missions & Secret Roles
-- Migration: 20260828170000_personal_roles_and_signal_carrier.sql
--
-- A player may hold more than one role_type simultaneously (e.g. assigned
-- MESSENGER, later becomes a SIGNAL_CARRIER through propagation) — hence
-- one row per (event, player, role_type) rather than a single role column.
-- MESSENGER/WITNESS/KEYHOLDER are assigned once, deterministically, and
-- never move. SIGNAL_CARRIER is the one role type that spreads: linking
-- with an existing carrier (via the existing player_links system) grants
-- it to the other player too — the origin/propagated_from_player_id
-- columns exist purely for audit, they gate nothing themselves.
--
-- Strictly private by design: RLS grants a player SELECT on their own rows
-- only. There is no public or cross-player read policy at all — "other
-- clients must not be able to query hidden roles" is enforced at the
-- database layer, not just by API-route discipline.

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
-- No INSERT/UPDATE policy — assignment and propagation are exclusively
-- server-side (lib/personal-roles-db.ts, via supabaseAdmin).
