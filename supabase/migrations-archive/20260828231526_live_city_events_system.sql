-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260828231526
-- Original recorded name:    20260828130000_live_city_events_system

-- Canton Quests — Live City Events System
CREATE TABLE IF NOT EXISTS public.live_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('FLASH_DROP','CITY_EVENT','SECTOR_EVENT','COMMUNITY_MILESTONE','XP_MULTIPLIER','TEMPORARY_UNLOCK','SPECIAL_OBJECTIVE','EMERGENCY_MESSAGE')),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed','cancelled','expired')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    sector_scope TEXT CHECK (sector_scope IS NULL OR sector_scope IN ('family','challenge','secret')),
    quest_scope_id UUID REFERENCES public.quests(id) ON DELETE SET NULL,
    multiplier_value NUMERIC,
    progress_current INTEGER NOT NULL DEFAULT 0,
    progress_target INTEGER,
    first_n_slots INTEGER,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','personalized')),
    commander_transmission_trigger TEXT,
    public_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    admin_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_live_events_event_status_type ON public.live_events(event_id,status,event_type);
CREATE INDEX IF NOT EXISTS idx_live_events_active_window ON public.live_events(event_id,starts_at,ends_at) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_live_events_quest_scope ON public.live_events(quest_scope_id) WHERE quest_scope_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.live_event_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_event_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created','activated','cancelled','expired','completed','milestone_crossed','multiplier_applied','first_n_awarded')),
    actor TEXT NOT NULL DEFAULT 'Game Master',
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_live_event_audit_log_live_event ON public.live_event_audit_log(live_event_id,created_at);
ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_event_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Live events readable for public projection" ON public.live_events;
DROP POLICY IF EXISTS "Live event audit log is server-only" ON public.live_event_audit_log;
CREATE OR REPLACE VIEW public.public_live_events WITH (security_barrier = true) AS
SELECT le.id,le.event_id,le.event_type,le.title,le.description,le.status,le.starts_at,le.ends_at,le.sector_scope,le.quest_scope_id,le.multiplier_value,le.progress_current,le.progress_target,le.first_n_slots,le.public_payload
FROM public.live_events le WHERE le.status='active' AND le.visibility='public';
GRANT SELECT ON public.public_live_events TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.increment_live_event_progress(p_live_event_id UUID,p_increment INTEGER)
RETURNS TABLE(new_current INTEGER,target INTEGER,just_crossed_threshold BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_new_current INTEGER; v_target INTEGER; v_old_current INTEGER;
BEGIN
  UPDATE public.live_events SET progress_current=progress_current+p_increment,updated_at=now()
  WHERE id=p_live_event_id AND status='active'
  RETURNING progress_current,progress_target INTO v_new_current,v_target;
  IF v_new_current IS NULL THEN RETURN; END IF;
  v_old_current:=v_new_current-p_increment;
  RETURN QUERY SELECT v_new_current,v_target,(v_target IS NOT NULL AND v_old_current<v_target AND v_new_current>=v_target);
END; $$;
REVOKE EXECUTE ON FUNCTION public.increment_live_event_progress(UUID,INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_live_event_progress(UUID,INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_live_event_progress(UUID,INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_live_event_progress(UUID,INTEGER) TO service_role;
