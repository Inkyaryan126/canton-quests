-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260828231551
-- Original recorded name:    20260828150000_field_npc_courier_system

CREATE TABLE IF NOT EXISTS public.field_npcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    npc_type TEXT NOT NULL CHECK (npc_type IN ('COURIER', 'WITNESS', 'MESSENGER', 'KEYHOLDER', 'COMMANDER_AGENT')),
    alias_name TEXT NOT NULL,
    public_description TEXT NOT NULL,
    avatar_symbol TEXT NOT NULL DEFAULT '🕵️',
    sector_scope TEXT CHECK (sector_scope IS NULL OR sector_scope IN ('family', 'challenge', 'secret')),
    broad_area_label TEXT,
    exact_location_lat DOUBLE PRECISION,
    exact_location_lon DOUBLE PRECISION,
    is_active BOOLEAN NOT NULL DEFAULT false,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    current_code TEXT,
    code_rotated_at TIMESTAMPTZ,
    claim_limit INTEGER,
    current_claims INTEGER NOT NULL DEFAULT 0,
    reward_xp INTEGER NOT NULL DEFAULT 0,
    reward_drawing_entries INTEGER NOT NULL DEFAULT 0,
    commander_transmission_trigger TEXT,
    operator_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
    CHECK (claim_limit IS NULL OR claim_limit >= 0)
);
CREATE INDEX IF NOT EXISTS idx_field_npcs_event_active ON public.field_npcs(event_id, is_active);
ALTER TABLE public.field_npcs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Field NPCs are server-only" ON public.field_npcs;
CREATE OR REPLACE VIEW public.public_field_npcs WITH (security_barrier = true) AS
SELECT id, event_id, npc_type, alias_name, public_description, avatar_symbol, sector_scope, broad_area_label, starts_at, ends_at, claim_limit, current_claims, reward_xp, reward_drawing_entries
FROM public.field_npcs
WHERE is_active = true;
GRANT SELECT ON public.public_field_npcs TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.claim_field_npc_slot(p_npc_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_claims INTEGER;
BEGIN
  UPDATE public.field_npcs
  SET current_claims = current_claims + 1,
      updated_at = now()
  WHERE id = p_npc_id
    AND is_active = true
    AND (claim_limit IS NULL OR current_claims < claim_limit)
  RETURNING current_claims INTO v_claims;
  RETURN v_claims;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_field_npc_slot(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_field_npc_slot(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_field_npc_slot(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_field_npc_slot(UUID) TO service_role;
ALTER TABLE public.reward_grants DROP CONSTRAINT IF EXISTS reward_grants_reward_type_check;
ALTER TABLE public.reward_grants ADD CONSTRAINT reward_grants_reward_type_check CHECK (reward_type IN (
    'QUEST_BASE','QUEST_FIELD_CHECKIN','QUEST_NFC','QUEST_PHOTO_VIDEO','QUEST_RACE_BONUS','QUEST_DRAWING_ENTRY_BONUS','BADGE_UNLOCK','COLLECTIBLE_UNLOCK','SECRET_UNLOCK','THREE_LOCKS_FRAGMENT','FINALE_PROGRESS','PROFILE_COMPLETION','PLAYER_LINK','NPC_CLAIM'
));
