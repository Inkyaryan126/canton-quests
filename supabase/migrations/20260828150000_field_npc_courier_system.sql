-- Canton Quests — Field NPC / Courier System
-- Migration: 20260828150000_field_npc_courier_system.sql
--
-- Real humans acting as Canton Quests NPCs (Courier, Witness, Messenger,
-- Keyholder, Commander Agent) — a richer, production-real sibling to the
-- existing public.npc_characters table, which has no active window, no
-- claim/inventory limits, no reward config, and is only ever read/written
-- through the local in-memory engine (confirmed: zero *DB functions in
-- lib/supabase-db.ts touch it, same gap Live City Events found and fixed
-- for Flash Drops/bonus windows/crowd objectives). npc_characters is left
-- untouched — it still drives the existing "Live Clue Card" UI — this is a
-- new, separate table for the real claim/reward mechanism this mission
-- asks for, not a migration of that data.
--
-- Location privacy: exact_location_lat/exact_location_lon are PRIVATE
-- (operator/GM reference only, e.g. "meet the courier here"); the public
-- projection below exposes only broad_area_label, an approximate,
-- human-authored description ("Near Centennial Plaza"). current_code is
-- also private — a player only ever supplies it (spoken to them in person
-- by the real NPC), never reads it back through any API.

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

-- Server-only by omission (RLS enabled, zero policies) — same pattern as
-- live_events and cipher_fragments' definitions table. All reads/writes go
-- through supabaseAdmin in lib/field-npcs-db.ts.
DROP POLICY IF EXISTS "Field NPCs are server-only" ON public.field_npcs;

-- Sanitized public projection: only currently-active NPCs, and only the
-- columns a player is allowed to see before claiming — never current_code,
-- exact_location_lat/lon, or operator_notes, regardless of how the base
-- table's RLS evolves.
CREATE OR REPLACE VIEW public.public_field_npcs
WITH (security_barrier = true) AS
SELECT
    id, event_id, npc_type, alias_name, public_description, avatar_symbol,
    sector_scope, broad_area_label, starts_at, ends_at, claim_limit, current_claims,
    reward_xp, reward_drawing_entries
FROM public.field_npcs
WHERE is_active = true;

GRANT SELECT ON public.public_field_npcs TO anon, authenticated;

-- Atomic, concurrency-safe claim-slot reservation — same single
-- UPDATE...RETURNING-under-row-lock shape as claim_quest_placement /
-- increment_live_event_progress. Returns NULL rows (no RETURNING match)
-- when the NPC doesn't exist, isn't active, or its claim_limit is already
-- reached — the caller treats an empty result as "cannot claim."
CREATE OR REPLACE FUNCTION public.claim_field_npc_slot(p_npc_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims INTEGER;
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

-- Extend reward_grants to allow NPC_CLAIM as a reward reason — reuses the
-- same event-scoped questless idempotency index Player Links added
-- (uq_reward_grants_player_event_type_key_no_quest, migration
-- 20260828140000), so a player can never claim the same NPC's reward twice
-- for this event.
ALTER TABLE public.reward_grants
  DROP CONSTRAINT IF EXISTS reward_grants_reward_type_check;

ALTER TABLE public.reward_grants
  ADD CONSTRAINT reward_grants_reward_type_check CHECK (reward_type IN (
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
    'FINALE_PROGRESS',
    'PROFILE_COMPLETION',
    'PLAYER_LINK',
    'NPC_CLAIM'
  ));
