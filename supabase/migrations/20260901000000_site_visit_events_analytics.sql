-- Canton Quests — First-Party Visitor Analytics (site_visit_events)
-- Migration: 20260901000000_site_visit_events_analytics.sql
--
-- New table backing the production-grade first-party analytics pipeline
-- (lib/site-analytics.ts, app/api/track/route.ts, app/api/admin/analytics).
-- Independent of and additive to:
--   - site_visits (20260822_site_visits.sql) — legacy geo-based visit log,
--     left untouched and still populated by app/api/track/route.ts.
--   - campaign_visits / qr_campaigns (20260813010000_qr_campaign_attribution.sql)
--     — QR/flyer short-link redirect tracking, left untouched. When a visit
--     originated from a campaign QR code, its attribution (campaign_id,
--     qr_code_id, flyer_variant_id) is copied onto the matching
--     site_visit_events row so it shows up in on-site page-view analytics
--     too, but campaign_visits remains the source of truth for QR redirect
--     counts.
--
-- No raw IP addresses are stored anywhere in this table.

CREATE TABLE IF NOT EXISTS public.site_visit_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id        TEXT        NOT NULL,
  session_id        TEXT        NOT NULL,
  player_id         UUID        NULL REFERENCES public.players(id) ON DELETE SET NULL,
  event_type        TEXT        NOT NULL DEFAULT 'page_view',
  path              TEXT        NOT NULL,
  referrer          TEXT        NULL,
  utm_source        TEXT        NULL,
  utm_medium        TEXT        NULL,
  utm_campaign      TEXT        NULL,
  utm_content       TEXT        NULL,
  utm_term          TEXT        NULL,
  qr_code_id        TEXT        NULL,
  flyer_variant_id  TEXT        NULL,
  campaign_id       TEXT        NULL,
  device_class      TEXT        NULL,
  user_agent_class  TEXT        NULL,
  is_bot            BOOLEAN     NOT NULL DEFAULT false,
  bot_reason        TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_visit_events_created_at_idx        ON public.site_visit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS site_visit_events_visitor_id_idx        ON public.site_visit_events (visitor_id);
CREATE INDEX IF NOT EXISTS site_visit_events_session_id_idx        ON public.site_visit_events (session_id);
CREATE INDEX IF NOT EXISTS site_visit_events_player_id_idx         ON public.site_visit_events (player_id);
CREATE INDEX IF NOT EXISTS site_visit_events_path_idx              ON public.site_visit_events (path);
CREATE INDEX IF NOT EXISTS site_visit_events_is_bot_created_at_idx ON public.site_visit_events (is_bot, created_at DESC);

-- Row Level Security: no anon/authenticated policies are defined below, so
-- RLS denies all access to those roles by default (matches the established
-- pattern in 20260828200000_admin_audit_log_and_gm_room.sql for
-- admin_audit_log). Only the service_role key — used exclusively by
-- server-side code in app/api/track/route.ts (inserts) and
-- app/api/admin/analytics/route.ts (reads, gated by resolveAdminSessionFromRequest)
-- — bypasses RLS, which is how Postgres/Supabase's service_role always
-- behaves regardless of policies. Public visitors and signed-in players can
-- never read or write this table directly.
ALTER TABLE public.site_visit_events ENABLE ROW LEVEL SECURITY;
