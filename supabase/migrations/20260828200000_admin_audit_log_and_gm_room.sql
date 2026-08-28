-- Canton Quests — Generic Admin Audit Log (Game Master Control Room)
-- Migration: 20260828200000_admin_audit_log_and_gm_room.sql
--
-- One reusable audit trail for GM mutations that don't already have their
-- own dedicated ledger — Live City Events keeps live_event_audit_log,
-- reward-granting keeps reward_grants; this covers everything else (NPC
-- lifecycle, Watcher activation, finale configuration, emergency
-- pause/phase changes). Server-only: no SELECT/INSERT policy for
-- anon/authenticated at all — every read and write goes through
-- supabaseAdmin (lib/admin-audit-db.ts), matching this session's other
-- admin-only tables.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    actor TEXT NOT NULL DEFAULT 'Game Master',
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_event_created ON public.admin_audit_log(event_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin audit log is server-only" ON public.admin_audit_log;
