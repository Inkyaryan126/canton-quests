-- Canton Quests — Live City Events System
-- Migration: 20260828130000_live_city_events_system.sql
--
-- One server-authoritative table for everything that makes the city feel
-- alive while players are actively playing: Flash Drops, City Events,
-- Sector Events, Community Milestones, XP Multipliers, Temporary Unlocks,
-- Special Objectives, and Emergency Messages. This supersedes three
-- existing-but-never-production-wired mechanisms (Quest.isFlash/startsAt/
-- expiresAt as the sole flash-drop signal, the bonus_windows table, and the
-- crowd_objectives table — all three currently only work against the local
-- in-memory engine; see lib/live-events.ts for the full architecture note)
-- rather than trying to wire three separate half-built systems together.
-- None of those tables/columns are touched or dropped here.
--
-- Where a live event is "about" an actual Quest (a Flash Drop or Special
-- Objective players complete), quest_scope_id points at it and completion
-- flows entirely through the existing quest_submissions /
-- awardQuestRewardsDB / claim_quest_placement pipeline — this table never
-- duplicates reward-granting, submission, or race-placement logic.
--
-- public_payload / admin_payload are deliberately separate JSONB columns
-- (not one shared blob) so the public-facing view below can never leak a
-- hidden answer, GM note, or unreleased detail regardless of what a future
-- event type happens to store in admin_payload.

CREATE TABLE IF NOT EXISTS public.live_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'FLASH_DROP',
        'CITY_EVENT',
        'SECTOR_EVENT',
        'COMMUNITY_MILESTONE',
        'XP_MULTIPLIER',
        'TEMPORARY_UNLOCK',
        'SPECIAL_OBJECTIVE',
        'EMERGENCY_MESSAGE'
    )),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'active', 'completed', 'cancelled', 'expired'
    )),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    -- Reuses the same value space as event_players.path / Quest.startingPath
    -- ('family' | 'challenge' | 'secret') — NULL means city-wide (no sector
    -- scope), matching CITY_EVENT vs SECTOR_EVENT from the mission spec.
    sector_scope TEXT CHECK (sector_scope IS NULL OR sector_scope IN ('family', 'challenge', 'secret')),
    -- Set when this live event IS an existing Quest going live (Flash Drop /
    -- Special Objective) — completion, verification, and reward-granting
    -- stay entirely on the existing quest_submissions/awardQuestRewardsDB
    -- path; this column is read-only context, never a second reward path.
    quest_scope_id UUID REFERENCES public.quests(id) ON DELETE SET NULL,
    -- XP_MULTIPLIER's effective multiplier, e.g. 1.25 / 1.5 / 2.0. First-class
    -- column (not payload JSONB) so the reward pipeline can read it with a
    -- single indexed lookup, mirroring bonus_windows.multiplier's shape.
    multiplier_value NUMERIC,
    -- COMMUNITY_MILESTONE running/target counts. Real columns (not JSONB) so
    -- increment_live_event_progress() below can update them atomically under
    -- concurrent quest completions.
    progress_current INTEGER NOT NULL DEFAULT 0,
    progress_target INTEGER,
    -- Optional "first N completers" bonus slot count for a quest-backed live
    -- event. Informational config only — actual placement ordinals are
    -- claimed through the existing claim_quest_placement(uuid) RPC via the
    -- linked quest, never tracked separately here.
    first_n_slots INTEGER,
    -- Watchers-readiness (mission section 15): 'public' events appear in the
    -- sanitized view below to every player in the operation; 'private' and
    -- 'personalized' are reserved for a future eligibility-scoped event (a
    -- hidden signal, a personalized clue window) and are never exposed
    -- through public_live_events regardless of status.
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'personalized')),
    -- Only ever set to a CommanderTransmissionTrigger value with real,
    -- matching video content behind it — never a placeholder/guessed
    -- mapping. NULL means "no Commander video for this event," which is the
    -- correct default for every event type today.
    commander_transmission_trigger TEXT,
    public_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    admin_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_live_events_event_status_type
  ON public.live_events(event_id, status, event_type);

CREATE INDEX IF NOT EXISTS idx_live_events_active_window
  ON public.live_events(event_id, starts_at, ends_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_live_events_quest_scope
  ON public.live_events(quest_scope_id)
  WHERE quest_scope_id IS NOT NULL;

-- Per-mutation audit trail (activated / cancelled / expired / milestone
-- crossed / multiplier applied / first-N placement awarded). No generic
-- admin-action log exists elsewhere in this codebase to extend (confirmed —
-- reward_grants and prize_draw_records.audit_metadata are the closest
-- precedents and are both feature-scoped, not generic), so this is new,
-- modeled directly on prize_draw_records.audit_metadata's shape: a JSONB
-- detail column plus a plain actor-identity field, append-only.
CREATE TABLE IF NOT EXISTS public.live_event_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_event_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        'created', 'activated', 'cancelled', 'expired', 'completed',
        'milestone_crossed', 'multiplier_applied', 'first_n_awarded'
    )),
    actor TEXT NOT NULL DEFAULT 'Game Master',
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_event_audit_log_live_event
  ON public.live_event_audit_log(live_event_id, created_at);

ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_event_audit_log ENABLE ROW LEVEL SECURITY;

-- Base tables are server-only by omission (RLS enabled, zero policies) —
-- the same pattern the founders_cipher_district_fragments migration uses
-- for cipher_fragments' definitions table. All reads/writes go through
-- supabaseAdmin (service role, bypasses RLS) in lib/live-events-db.ts; the
-- sanitized view below is the only client-reachable surface.
DROP POLICY IF EXISTS "Live events readable for public projection" ON public.live_events;
DROP POLICY IF EXISTS "Live event audit log is server-only" ON public.live_event_audit_log;

-- Sanitized public projection: only currently-active, public-visibility
-- events, and only the columns gameplay needs — never admin_payload,
-- created_by, or commander_transmission_trigger (internal wiring detail,
-- not something a client needs to render anything). Matches the
-- public_quest_steps house style (security_barrier view, explicit column
-- allowlist, WHERE-filtered, GRANT SELECT to anon/authenticated over an
-- RLS-locked base table).
CREATE OR REPLACE VIEW public.public_live_events
WITH (security_barrier = true) AS
SELECT
    le.id,
    le.event_id,
    le.event_type,
    le.title,
    le.description,
    le.status,
    le.starts_at,
    le.ends_at,
    le.sector_scope,
    le.quest_scope_id,
    le.multiplier_value,
    le.progress_current,
    le.progress_target,
    le.first_n_slots,
    le.public_payload
FROM public.live_events le
WHERE le.status = 'active' AND le.visibility = 'public';

GRANT SELECT ON public.public_live_events TO anon, authenticated;

-- Atomic, concurrency-safe milestone-progress increment. Single
-- UPDATE...RETURNING (same shape as claim_quest_placement) so concurrent
-- quest completions serialize on the row lock instead of racing a
-- read-then-write. just_crossed_threshold is true for exactly one caller —
-- the specific increment whose resulting progress_current first reaches
-- progress_target — computed from the same locked row, not a separate
-- read, so it can never be true for two concurrent calls.
CREATE OR REPLACE FUNCTION public.increment_live_event_progress(
  p_live_event_id UUID,
  p_increment INTEGER
)
RETURNS TABLE(new_current INTEGER, target INTEGER, just_crossed_threshold BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_current INTEGER;
  v_target INTEGER;
  v_old_current INTEGER;
BEGIN
  UPDATE public.live_events
  SET progress_current = progress_current + p_increment,
      updated_at = now()
  WHERE id = p_live_event_id AND status = 'active'
  RETURNING progress_current, progress_target INTO v_new_current, v_target;

  IF v_new_current IS NULL THEN
    RETURN;
  END IF;

  v_old_current := v_new_current - p_increment;

  RETURN QUERY SELECT
    v_new_current,
    v_target,
    (v_target IS NOT NULL AND v_old_current < v_target AND v_new_current >= v_target);
END;
$$;

-- Same server-only lockdown pattern as claim_quest_placement /
-- increment_drawing_entries: created without EXECUTE restrictions, Postgres
-- defaults to PUBLIC-callable, so revoke explicitly and grant only to
-- service_role. Verified call site: lib/live-events-db.ts's
-- incrementLiveEventProgressDB, invoked only from awardQuestRewardsDB's
-- call sites in lib/supabase-db.ts (service-role context).
REVOKE EXECUTE ON FUNCTION public.increment_live_event_progress(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_live_event_progress(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_live_event_progress(UUID, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_live_event_progress(UUID, INTEGER) TO service_role;
