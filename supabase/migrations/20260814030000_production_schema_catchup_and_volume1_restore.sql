-- =============================================================================
-- Canton Quests Migration: Production Schema Catch-Up & Volume 1 Restoration
-- Version: 20260814030000
-- Description: Single, safe, idempotent, non-destructive catch-up migration that
--              brings a live Supabase instance (currently at Phase 3 schema, with
--              20260814010000 already run early) to the complete, required modern
--              state and restores canonical Canton Quests Volume 1 game data.
--
-- Lineage Consolidated:
--   1. Phase 4: Event Factory (events extensions, quest_submissions flags, generated_qrs, quest_templates)
--   2. Phase 5.1: Spectator Engine (audience events, votes, effects, public feed, broadcasts, spectator sessions)
--   3. Core Quest Rewards Backbone (XP & Drawing Entry rewards, multi-step quest_steps, drawing ledger, views)
--   4. Transparent Prize Drawing System (event_prizes, prize_draw_records, ledger lock triggers & RPCs, public projections)
--   5. QR Campaign Attribution (qr_campaigns, variants, distributors, campaign QR tracking, street team seed)
--   6. Player Identity & Three-Path Architecture (starting_path, achievements catalog, player_achievements)
--   7. Critical Player Auth Remediation (Hardened players/submissions RLS, anti-tampering trigger, user_id index)
--   8. Canonical Canton Quests Volume 1 Restoration (City, Locations, Event, Quests, Steps, Collectibles, Codes, NPC, Partners, Prizes)
--
-- Invariants Guaranteed:
--   - 100% Idempotent: safe to run once or multiple times without errors.
--   - Zero destructive operations: no DROP TABLE, no TRUNCATE, no DELETE.
--   - Critical Player Auth hardening from 20260814010000 enforced as the final authoritative RLS state.
--   - Zero demo/fake players seeded (auth.users -> players onboarding chain intact).
--   - Sensitive verification answers hashed with SHA-256 (sha256:...).
--   - Frankenstein Monument daylight/respect rules preserved with coordinates NULL pending human field walk.
-- =============================================================================

-- Enable standard UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- SECTION 1: Phase 4 — Event Factory Extensions & Tables
-- =============================================================================

-- 1.1 Extend Events table with Event Factory configuration columns
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS safety_notes TEXT,
  ADD COLUMN IF NOT EXISTS map_center_lat DOUBLE PRECISION DEFAULT 40.7989,
  ADD COLUMN IF NOT EXISTS map_center_lon DOUBLE PRECISION DEFAULT -81.3748,
  ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS readiness_status TEXT DEFAULT 'draft';

-- 1.2 Extend Quest Submissions for review metadata & retry requests
ALTER TABLE public.quest_submissions
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT,
  ADD COLUMN IF NOT EXISTS review_flags JSONB,
  ADD COLUMN IF NOT EXISTS retry_requested BOOLEAN DEFAULT false;

-- 1.3 Extend NPC Characters for private Game Master operator notes
ALTER TABLE public.npc_characters
  ADD COLUMN IF NOT EXISTS operator_notes TEXT;

-- 1.4 Generated QR Codes Table
CREATE TABLE IF NOT EXISTS public.generated_qrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('quest', 'secret', 'code', 'checkpoint', 'partner')),
  target_id TEXT NOT NULL,
  target_url TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_qrs_event ON public.generated_qrs(event_id);
CREATE INDEX IF NOT EXISTS idx_generated_qrs_token ON public.generated_qrs(token);

ALTER TABLE public.generated_qrs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Generated QRs viewable by everyone" ON public.generated_qrs;
CREATE POLICY "Generated QRs viewable by everyone" ON public.generated_qrs FOR SELECT USING (true);

-- 1.5 Quest Templates Table
CREATE TABLE IF NOT EXISTS public.quest_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  preset JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quest_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Quest templates viewable by everyone" ON public.quest_templates;
CREATE POLICY "Quest templates viewable by everyone" ON public.quest_templates FOR SELECT USING (true);

-- 1.6 Storage Bucket for Quest Media Proofs (conditional block)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('quest-proofs', 'quest-proofs', true)
  ON CONFLICT (id) DO NOTHING;

  DROP POLICY IF EXISTS "Quest proofs public read access" ON storage.objects;
  CREATE POLICY "Quest proofs public read access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'quest-proofs');

  DROP POLICY IF EXISTS "Quest proofs authenticated upload" ON storage.objects;
  CREATE POLICY "Quest proofs authenticated upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'quest-proofs');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Safe fallback if storage schema is not present in local test environments
END $$;


-- =============================================================================
-- SECTION 2: Phase 5.1 — Spectator Participation Engine & Safety Foundation
-- =============================================================================

-- 2.1 Audience Events Table
CREATE TABLE IF NOT EXISTS public.audience_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('audience_vote', 'player_benefit', 'world_event', 'crowd_meter')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'voting_active', 'tallying_closed', 'effect_applied', 'resolved', 'cancelled')),
  is_paused BOOLEAN NOT NULL DEFAULT false,
  paused_at TIMESTAMPTZ,
  eligibility_mode TEXT NOT NULL DEFAULT 'all_spectators' CHECK (eligibility_mode IN ('all_spectators', 'authenticated_only', 'exclude_active_players')),
  max_votes_per_session INTEGER NOT NULL DEFAULT 1 CHECK (max_votes_per_session = 1),
  target_type TEXT CHECK (target_type IN ('category', 'quest', 'team', 'zone', 'citywide')),
  target_id TEXT,
  target_name TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  winning_option_id UUID,
  is_manually_overridden BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  resolved_by UUID REFERENCES public.players(id),
  created_by UUID REFERENCES public.players(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_audience_event
  ON public.audience_events (event_id)
  WHERE (status = 'voting_active');

CREATE INDEX IF NOT EXISTS idx_audience_events_lookup
  ON public.audience_events(event_id, status);

-- 2.2 Public Audience Events View (Sanitizes internal admin IDs & secrets)
CREATE OR REPLACE VIEW public.public_audience_events
WITH (security_barrier = true) AS
SELECT
  e.id,
  e.event_id,
  e.title,
  e.description,
  e.event_type,
  e.status,
  e.is_paused,
  e.starts_at,
  e.ends_at,
  e.paused_at,
  e.eligibility_mode,
  e.max_votes_per_session,
  CASE
    WHEN e.target_type = 'category' THEN e.target_name
    ELSE 'Game Target'
  END AS public_target_description,
  CASE
    WHEN e.status = 'resolved' THEN e.winning_option_id
    ELSE NULL
  END AS public_winning_option_id,
  e.created_at
FROM public.audience_events e
WHERE e.status IN ('voting_active', 'tallying_closed', 'effect_applied', 'resolved');

-- 2.3 Audience Event Options Table
CREATE TABLE IF NOT EXISTS public.audience_event_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_event_id UUID NOT NULL REFERENCES public.audience_events(id) ON DELETE CASCADE,
  option_label TEXT NOT NULL,
  option_description TEXT,
  effect_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  vote_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_option_id_event_id UNIQUE (id, audience_event_id)
);

-- 2.4 Public Audience Event Options View (Masks internal effect payload)
CREATE OR REPLACE VIEW public.public_audience_event_options
WITH (security_barrier = true) AS
SELECT
  o.id,
  o.audience_event_id,
  o.option_label,
  o.option_description,
  o.vote_count,
  o.sort_order,
  o.created_at
FROM public.audience_event_options o
JOIN public.audience_events e ON e.id = o.audience_event_id
WHERE e.status IN ('voting_active', 'tallying_closed', 'effect_applied', 'resolved');

-- 2.5 Audience Votes Table
CREATE TABLE IF NOT EXISTS public.audience_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_event_id UUID NOT NULL REFERENCES public.audience_events(id) ON DELETE CASCADE,
  option_id UUID NOT NULL,
  session_token_hash TEXT NOT NULL,
  vote_number INTEGER NOT NULL DEFAULT 1 CHECK (vote_number >= 1),
  ip_hash TEXT NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_spectator_one_vote_per_event UNIQUE (audience_event_id, session_token_hash),
  CONSTRAINT fk_vote_option_event FOREIGN KEY (option_id, audience_event_id) REFERENCES public.audience_event_options(id, audience_event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audience_votes_lookup
  ON public.audience_votes(audience_event_id, session_token_hash);

-- 2.6 Audience Effects Applied Ledger
CREATE TABLE IF NOT EXISTS public.audience_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_event_id UUID NOT NULL REFERENCES public.audience_events(id) ON DELETE CASCADE,
  effect_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'cancelled', 'overridden')),
  applied_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  override_context TEXT,
  created_by UUID REFERENCES public.players(id),
  applied_by UUID REFERENCES public.players(id),
  resolved_by UUID REFERENCES public.players(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 Public Game Feed Table
CREATE TABLE IF NOT EXISTS public.public_game_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL,
  headline TEXT NOT NULL,
  body TEXT,
  district_name TEXT,
  urgency TEXT NOT NULL DEFAULT 'info' CHECK (urgency IN ('info', 'warning', 'flash', 'urgent')),
  is_host BOOLEAN NOT NULL DEFAULT false,
  is_retracted BOOLEAN NOT NULL DEFAULT false,
  is_minor_participant BOOLEAN NOT NULL DEFAULT false,
  is_public_feed_eligible BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_feed_published
  ON public.public_game_feed(event_id, published_at DESC)
  WHERE (is_retracted = false AND is_public_feed_eligible = true AND is_minor_participant = false);

-- 2.8 Host Broadcasts Table & Public View
CREATE TABLE IF NOT EXISTS public.host_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'theatrical' CHECK (tone IN ('theatrical', 'urgent', 'announcement', 'flash')),
  target_channel TEXT NOT NULL DEFAULT 'all' CHECK (target_channel IN ('all', 'spectators', 'players', 'internal')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW public.public_host_broadcasts
WITH (security_barrier = true) AS
SELECT
  b.id,
  b.event_id,
  b.headline,
  b.body,
  b.tone,
  b.target_channel,
  b.priority,
  b.published_at,
  b.created_at
FROM public.host_broadcasts b
WHERE b.is_published = true
  AND b.published_at <= NOW()
  AND b.target_channel IN ('all', 'spectators');

-- 2.9 Spectator Sessions Ledger
CREATE TABLE IF NOT EXISTS public.spectator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash TEXT UNIQUE NOT NULL,
  ip_hash TEXT NOT NULL,
  converted_to_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  is_minor BOOLEAN NOT NULL DEFAULT false,
  age_acknowledged_at TIMESTAMPTZ,
  safety_acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 Spectator System Settings Table (Kill Switch)
CREATE TABLE IF NOT EXISTS public.spectator_system_settings (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  is_spectator_system_disabled BOOLEAN NOT NULL DEFAULT false,
  disabled_reason TEXT,
  disabled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.11 Spectator Functions, Triggers, and RPCs
CREATE OR REPLACE FUNCTION public.check_spectator_vote_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_max INTEGER;
  v_count INTEGER;
BEGIN
  SELECT max_votes_per_session INTO v_max
  FROM public.audience_events
  WHERE id = NEW.audience_event_id;

  SELECT COUNT(*) INTO v_count
  FROM public.audience_votes
  WHERE audience_event_id = NEW.audience_event_id
    AND session_token_hash = NEW.session_token_hash
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_count >= 1 THEN
    RAISE EXCEPTION 'Vote limit exceeded: session already cast % vote (max allowed: 1)', v_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_spectator_vote_limit ON public.audience_votes;
CREATE TRIGGER trg_enforce_spectator_vote_limit
  BEFORE INSERT ON public.audience_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_spectator_vote_limit();

CREATE OR REPLACE FUNCTION public.prevent_player_role_self_elevation()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.role IS NOT NULL AND NEW.role != 'player') THEN
      IF (current_setting('role', true) <> 'service_role' AND auth.role() <> 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized attempt to set privileged player role on insert.';
      END IF;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.role IS DISTINCT FROM OLD.role) THEN
      IF (current_setting('role', true) <> 'service_role' AND auth.role() <> 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized attempt to modify player role column.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_player_role ON public.players;
CREATE TRIGGER trg_protect_player_role
  BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_player_role_self_elevation();

CREATE OR REPLACE FUNCTION public.cast_spectator_vote(
  p_audience_event_id UUID,
  p_option_id UUID,
  p_session_token_hash TEXT,
  p_ip_hash TEXT,
  p_player_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_event public.audience_events;
  v_existing_votes INTEGER;
  v_next_vote_number INTEGER;
  v_vote_id UUID;
  v_updated_vote_count INTEGER;
BEGIN
  SELECT * INTO v_event
  FROM public.audience_events
  WHERE id = p_audience_event_id
  FOR SHARE;

  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audience event not found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.spectator_system_settings s
    WHERE s.event_id = v_event.event_id
      AND s.is_spectator_system_disabled = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Spectator system is currently frozen by Game Master',
      'code', 'SPECTATOR_SYSTEM_DISABLED'
    );
  END IF;

  IF v_event.status != 'voting_active' OR v_event.is_paused = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voting is not active for this event');
  END IF;

  IF v_event.ends_at IS NOT NULL AND NOW() > v_event.ends_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voting window has expired');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.audience_event_options
    WHERE id = p_option_id AND audience_event_id = p_audience_event_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid option for this audience event');
  END IF;

  IF v_event.eligibility_mode = 'authenticated_only' AND p_player_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required for this vote');
  END IF;

  IF v_event.eligibility_mode = 'exclude_active_players' AND p_player_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.quest_submissions
      WHERE player_id = p_player_id
        AND (status = 'pending' OR submitted_at >= NOW() - INTERVAL '30 minutes')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Active quest players cannot participate in this spectator vote');
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_existing_votes
  FROM public.audience_votes
  WHERE audience_event_id = p_audience_event_id
    AND session_token_hash = p_session_token_hash;

  IF v_existing_votes >= 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session vote limit reached (1 vote per spectator allowed)',
      'code', 'VOTE_LIMIT_REACHED'
    );
  END IF;

  v_next_vote_number := v_existing_votes + 1;

  INSERT INTO public.audience_votes (
    audience_event_id,
    option_id,
    session_token_hash,
    vote_number,
    ip_hash,
    player_id
  ) VALUES (
    p_audience_event_id,
    p_option_id,
    p_session_token_hash,
    v_next_vote_number,
    p_ip_hash,
    p_player_id
  ) RETURNING id INTO v_vote_id;

  UPDATE public.audience_event_options
  SET vote_count = vote_count + 1
  WHERE id = p_option_id
  RETURNING vote_count INTO v_updated_vote_count;

  RETURN jsonb_build_object(
    'success', true,
    'vote_id', v_vote_id,
    'vote_number', v_next_vote_number,
    'new_vote_count', v_updated_vote_count
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate vote detected', 'code', 'DUPLICATE_VOTE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.register_or_update_spectator_session(
  p_session_token_hash TEXT,
  p_ip_hash TEXT,
  p_is_minor BOOLEAN DEFAULT NULL,
  p_age_acknowledged BOOLEAN DEFAULT false,
  p_safety_acknowledged BOOLEAN DEFAULT false
) RETURNS public.spectator_sessions AS $$
DECLARE
  v_session public.spectator_sessions;
BEGIN
  INSERT INTO public.spectator_sessions (
    session_token_hash,
    ip_hash,
    is_minor,
    age_acknowledged_at,
    safety_acknowledged_at,
    last_seen_at
  )
  VALUES (
    p_session_token_hash,
    p_ip_hash,
    COALESCE(p_is_minor, false),
    CASE WHEN p_age_acknowledged THEN NOW() ELSE NULL END,
    CASE WHEN p_safety_acknowledged THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (session_token_hash)
  DO UPDATE SET
    last_seen_at = NOW(),
    ip_hash = EXCLUDED.ip_hash,
    is_minor = spectator_sessions.is_minor OR COALESCE(p_is_minor, false),
    age_acknowledged_at = COALESCE(EXCLUDED.age_acknowledged_at, spectator_sessions.age_acknowledged_at),
    safety_acknowledged_at = COALESCE(EXCLUDED.safety_acknowledged_at, spectator_sessions.safety_acknowledged_at)
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.convert_spectator_session_to_player(
  p_session_token_hash TEXT,
  p_player_id UUID
) RETURNS public.spectator_sessions AS $$
DECLARE
  v_session public.spectator_sessions;
BEGIN
  UPDATE public.spectator_sessions
  SET converted_to_player_id = p_player_id, last_seen_at = NOW()
  WHERE session_token_hash = p_session_token_hash
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2.12 Spectator RLS Policies & Grants
ALTER TABLE public.audience_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_event_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_game_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spectator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spectator_system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access only for raw audience_events" ON public.audience_events;
CREATE POLICY "Admin access only for raw audience_events" ON public.audience_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin full access to audience_event_options" ON public.audience_event_options;
CREATE POLICY "Admin full access to audience_event_options" ON public.audience_event_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.audience_votes FROM anon, authenticated;
DROP POLICY IF EXISTS "Admin view all votes" ON public.audience_votes;
CREATE POLICY "Admin view all votes" ON public.audience_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin access only for audience effects" ON public.audience_effects;
CREATE POLICY "Admin access only for audience effects" ON public.audience_effects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public read non-retracted published feed" ON public.public_game_feed;
CREATE POLICY "Public read non-retracted published feed" ON public.public_game_feed
  FOR SELECT USING (
    published_at <= NOW()
    AND is_retracted = false
    AND is_public_feed_eligible = true
    AND is_minor_participant = false
  );

DROP POLICY IF EXISTS "Admin write access for public feed" ON public.public_game_feed;
CREATE POLICY "Admin write access for public feed" ON public.public_game_feed
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public read published host broadcasts" ON public.host_broadcasts;
DROP POLICY IF EXISTS "Public read host broadcasts" ON public.host_broadcasts;
CREATE POLICY "Public read published host broadcasts" ON public.host_broadcasts
  FOR SELECT USING (
    is_published = true
    AND published_at <= NOW()
    AND target_channel IN ('all', 'spectators')
  );

DROP POLICY IF EXISTS "Admin write access for host broadcasts" ON public.host_broadcasts;
CREATE POLICY "Admin write access for host broadcasts" ON public.host_broadcasts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin view all spectator sessions" ON public.spectator_sessions;
CREATE POLICY "Admin view all spectator sessions" ON public.spectator_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public read spectator system settings" ON public.spectator_system_settings;
CREATE POLICY "Public read spectator system settings" ON public.spectator_system_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write spectator system settings" ON public.spectator_system_settings;
CREATE POLICY "Admin write spectator system settings" ON public.spectator_system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

GRANT SELECT ON public.public_audience_events TO anon, authenticated;
GRANT SELECT ON public.public_audience_event_options TO anon, authenticated;
GRANT SELECT ON public.public_host_broadcasts TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cast_spectator_vote(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_spectator_vote(UUID, UUID, TEXT, TEXT, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_or_update_spectator_session(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_or_update_spectator_session(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;

REVOKE EXECUTE ON FUNCTION public.convert_spectator_session_to_player(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_spectator_session_to_player(TEXT, UUID) TO service_role;


-- =============================================================================
-- SECTION 3: Core Quest Rewards Backbone
-- =============================================================================

-- 3.1 Extend Quests table
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS xp_reward INTEGER,
  ADD COLUMN IF NOT EXISTS drawing_entry_reward INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS gm_notes TEXT,
  ADD COLUMN IF NOT EXISTS safety_notes TEXT;

-- 3.2 Update Check Constraints on Quests and Submissions
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_verification_type_check;
ALTER TABLE public.quests ADD CONSTRAINT quests_verification_type_check
  CHECK (verification_type IN ('checkin', 'qr', 'passphrase', 'photo', 'video', 'gps', 'game_master', 'multi_step'));

ALTER TABLE public.quest_submissions DROP CONSTRAINT IF EXISTS quest_submissions_status_check;
ALTER TABLE public.quest_submissions ADD CONSTRAINT quest_submissions_status_check
  CHECK (status IN ('not_started', 'in_progress', 'pending', 'verified', 'rejected', 'retry_requested'));

-- 3.3 Extend Quest Submissions table
ALTER TABLE public.quest_submissions
  ADD COLUMN IF NOT EXISTS drawing_entries_awarded INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_step_order INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quests_id_event_id_unique'
      AND conrelid = 'public.quests'::regclass
  ) THEN
    ALTER TABLE public.quests
      ADD CONSTRAINT quests_id_event_id_unique UNIQUE (id, event_id);
  END IF;
END $$;

ALTER TABLE public.quest_submissions
  DROP CONSTRAINT IF EXISTS quest_submissions_quest_event_fk;
ALTER TABLE public.quest_submissions
  ADD CONSTRAINT quest_submissions_quest_event_fk
  FOREIGN KEY (quest_id, event_id) REFERENCES public.quests(id, event_id) ON DELETE CASCADE;

-- 3.4 Quest Steps Table (Multi-Step Quests)
CREATE TABLE IF NOT EXISTS public.quest_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  verification_type TEXT NOT NULL DEFAULT 'passphrase',
  target_code TEXT,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  radius_meters INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT quest_steps_verification_type_check CHECK (verification_type IN ('checkin', 'qr', 'passphrase', 'photo', 'video', 'gps', 'game_master')),
  UNIQUE(quest_id, step_order)
);

-- 3.5 Drawing Entry Ledger Table
CREATE TABLE IF NOT EXISTS public.drawing_entry_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  quest_id UUID REFERENCES public.quests(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES public.quest_submissions(id) ON DELETE SET NULL,
  entries_count INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL DEFAULT 'quest_completion',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drawing_entries_positive_check CHECK (entries_count > 0),
  CONSTRAINT uq_player_event_quest_drawing UNIQUE(event_id, player_id, quest_id)
);

-- 3.6 Drawing Ledger Locks Table
CREATE TABLE IF NOT EXISTS public.drawing_ledger_locks (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  lock_reason TEXT,
  locked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawing_ledger_event_player ON public.drawing_entry_ledger(event_id, player_id);
CREATE INDEX IF NOT EXISTS idx_drawing_ledger_quest ON public.drawing_entry_ledger(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_steps_quest ON public.quest_steps(quest_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_score_quest_completion_xp
  ON public.score_ledger(event_id, player_id, quest_id)
  WHERE quest_id IS NOT NULL AND points > 0 AND category = 'quest_completion';

ALTER TABLE public.quest_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawing_entry_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawing_ledger_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quests viewable by everyone" ON public.quests;
DROP POLICY IF EXISTS "Admins can view raw quests" ON public.quests;
CREATE POLICY "Admins can view raw quests" ON public.quests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Players can view submissions" ON public.quest_submissions;
DROP POLICY IF EXISTS "Players can view own submissions" ON public.quest_submissions;
CREATE POLICY "Players can view own submissions" ON public.quest_submissions
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id)
    OR EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Score ledger viewable by everyone" ON public.score_ledger;
DROP POLICY IF EXISTS "Admins can view score ledger" ON public.score_ledger;
CREATE POLICY "Admins can view score ledger" ON public.score_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view raw drawing entries" ON public.drawing_entry_ledger;
CREATE POLICY "Admins can view raw drawing entries" ON public.drawing_entry_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

-- 3.7 Public Sanitized Views
CREATE OR REPLACE VIEW public.public_quests
WITH (security_barrier = true) AS
SELECT
  q.id,
  q.event_id,
  q.location_id,
  q.title,
  q.slug,
  q.description,
  q.instructions,
  q.point_value,
  q.xp_reward,
  q.drawing_entry_reward,
  q.difficulty,
  q.category,
  q.verification_type,
  q.proof_requirement,
  q.is_flash,
  q.starts_at,
  q.expires_at,
  q.status,
  q.sort_order,
  q.created_at,
  q.safety_notes,
  q.radius_meters,
  q.prerequisite_quest_id,
  q.unlock_condition_type,
  q.require_location_verification,
  q.require_qr_and_location,
  q.claim_limit,
  q.current_claims,
  q.is_secret,
  q.is_finale_quest,
  q.race_rewards,
  q.hints,
  q.risk_reward,
  q.required_collectible_id
FROM public.quests q
WHERE q.status = 'active';

CREATE OR REPLACE VIEW public.public_quest_steps
WITH (security_barrier = true) AS
SELECT
  id,
  quest_id,
  step_order,
  title,
  instructions,
  verification_type,
  location_id,
  radius_meters,
  created_at
FROM public.quest_steps;

GRANT SELECT ON public.public_quests TO anon, authenticated;
GRANT SELECT ON public.public_quest_steps TO anon, authenticated;


-- =============================================================================
-- SECTION 4: Transparent Prize Drawing System
-- =============================================================================

-- 4.1 Extend drawing_ledger_locks table with snapshot metadata
ALTER TABLE public.drawing_ledger_locks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS snapshot_hash TEXT,
  ADD COLUMN IF NOT EXISTS canonical_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS total_qualified_entries INTEGER,
  ADD COLUMN IF NOT EXISTS total_qualified_players INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.drawing_ledger_locks DROP CONSTRAINT IF EXISTS drawing_ledger_locks_status_check;
ALTER TABLE public.drawing_ledger_locks ADD CONSTRAINT drawing_ledger_locks_status_check
  CHECK (status IN ('open', 'review', 'locked', 'drawn', 'published', 'cancelled'));

DROP POLICY IF EXISTS "Drawing ledger locks viewable by everyone" ON public.drawing_ledger_locks;
DROP POLICY IF EXISTS "Admins can view drawing ledger locks" ON public.drawing_ledger_locks;
CREATE POLICY "Admins can view drawing ledger locks" ON public.drawing_ledger_locks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

-- 4.2 Event Prizes Table
CREATE TABLE IF NOT EXISTS public.event_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sponsor_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  eligibility_rule TEXT NOT NULL DEFAULT 'all_qualified_players',
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.3 Prize Draw Records Table
CREATE TABLE IF NOT EXISTS public.prize_draw_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  prize_id UUID REFERENCES public.event_prizes(id) ON DELETE SET NULL,
  prize_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drawn',
  locked_ledger_hash TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL,
  draw_method TEXT NOT NULL DEFAULT 'internal_test',
  provider_reference TEXT,
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  winning_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  winning_public_player_label TEXT NOT NULL,
  selected_weighted_entry_index INTEGER NOT NULL,
  audit_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prize_draw_records_status_check CHECK (status IN ('drawn', 'published', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_prize_draw_records_event ON public.prize_draw_records(event_id);
CREATE INDEX IF NOT EXISTS idx_event_prizes_event ON public.event_prizes(event_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_prize_draw_per_event_prize 
  ON public.prize_draw_records(event_id, prize_title, locked_ledger_hash) 
  WHERE status != 'cancelled';

ALTER TABLE public.event_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_draw_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prizes viewable by everyone" ON public.event_prizes;
CREATE POLICY "Prizes viewable by everyone" ON public.event_prizes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can view prize draw records" ON public.prize_draw_records;
CREATE POLICY "Admins can view prize draw records" ON public.prize_draw_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

-- 4.4 Triggers: Lock & Snapshot Immutability
CREATE OR REPLACE FUNCTION public.fn_prevent_locked_drawing_ledger_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT COALESCE(is_locked, false), status INTO v_is_locked, v_status
  FROM public.drawing_ledger_locks
  WHERE event_id = COALESCE(NEW.event_id, OLD.event_id);

  IF v_is_locked OR v_status IN ('locked', 'drawn', 'published', 'cancelled') THEN
    RAISE EXCEPTION 'Drawing entry ledger is locked for event %. Mutations are prohibited.', COALESCE(NEW.event_id, OLD.event_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_drawing_ledger_edits ON public.drawing_entry_ledger;
CREATE TRIGGER trg_prevent_locked_drawing_ledger_edits
  BEFORE INSERT OR UPDATE OR DELETE ON public.drawing_entry_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_locked_drawing_ledger_edits();

CREATE OR REPLACE FUNCTION public.fn_prevent_locked_drawing_ledger_locks_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked OR OLD.status IN ('locked', 'drawn', 'published', 'cancelled') THEN
      RAISE EXCEPTION 'Drawing ledger lock record for event % is locked/finalized and cannot be deleted.', OLD.event_id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_locked OR OLD.status IN ('locked', 'drawn', 'published', 'cancelled') THEN
    IF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
      RAISE EXCEPTION 'Drawing ledger lock for event % is cancelled. Cancelled ledgers are terminal and cannot transition to status %.', OLD.event_id, NEW.status;
    END IF;

    IF OLD.status = 'locked' AND NEW.status NOT IN ('locked', 'drawn', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid lifecycle transition for event %: locked ledger cannot transition to status %.', OLD.event_id, NEW.status;
    END IF;

    IF OLD.status = 'drawn' AND NEW.status NOT IN ('drawn', 'published', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid lifecycle transition for event %: drawn ledger cannot transition to status %.', OLD.event_id, NEW.status;
    END IF;

    IF OLD.status = 'published' AND NEW.status NOT IN ('published', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid lifecycle transition for event %: published ledger cannot transition to status %.', OLD.event_id, NEW.status;
    END IF;

    IF OLD.snapshot_hash IS NOT NULL AND NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash THEN
      RAISE EXCEPTION 'Cannot mutate snapshot_hash on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.canonical_snapshot IS NOT NULL AND NEW.canonical_snapshot IS DISTINCT FROM OLD.canonical_snapshot THEN
      RAISE EXCEPTION 'Cannot mutate canonical_snapshot on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.locked_at IS NOT NULL AND NEW.locked_at IS DISTINCT FROM OLD.locked_at THEN
      RAISE EXCEPTION 'Cannot mutate locked_at on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.total_qualified_entries IS NOT NULL AND NEW.total_qualified_entries IS DISTINCT FROM OLD.total_qualified_entries THEN
      RAISE EXCEPTION 'Cannot mutate total_qualified_entries on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.total_qualified_players IS NOT NULL AND NEW.total_qualified_players IS DISTINCT FROM OLD.total_qualified_players THEN
      RAISE EXCEPTION 'Cannot mutate total_qualified_players on locked drawing ledger lock for event %.', OLD.event_id;
    END IF;

    IF OLD.is_locked AND NOT NEW.is_locked AND NEW.status != 'cancelled' THEN
      RAISE EXCEPTION 'Cannot unlock a locked drawing ledger for event % without explicit cancellation status.', OLD.event_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_drawing_ledger_locks_edits ON public.drawing_ledger_locks;
CREATE TRIGGER trg_prevent_locked_drawing_ledger_locks_edits
  BEFORE UPDATE OR DELETE ON public.drawing_ledger_locks
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_locked_drawing_ledger_locks_edits();

-- 4.5 Atomic Draw and Publish Functions (Service Role Executable Only)
CREATE OR REPLACE FUNCTION public.execute_prize_draw_if_drawable(
  p_event_id UUID,
  p_allowed_statuses TEXT[],
  p_draw_record JSONB
)
RETURNS SETOF public.prize_draw_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_status TEXT;
  v_inserted public.prize_draw_records;
BEGIN
  SELECT status INTO v_lock_status
  FROM public.drawing_ledger_locks
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF v_lock_status IS NULL THEN
    RAISE EXCEPTION 'Drawing ledger lock not found for event %.', p_event_id;
  END IF;

  IF v_lock_status = 'cancelled'
    OR NOT (v_lock_status = ANY(p_allowed_statuses))
    OR v_lock_status NOT IN ('locked', 'drawn') THEN
    RAISE EXCEPTION 'Cannot execute prize draw for event %. Ledger status % is not drawable.', p_event_id, v_lock_status;
  END IF;

  INSERT INTO public.prize_draw_records (
    event_id,
    prize_id,
    prize_title,
    status,
    locked_ledger_hash,
    locked_at,
    draw_method,
    provider_reference,
    drawn_at,
    winning_player_id,
    winning_public_player_label,
    selected_weighted_entry_index,
    audit_metadata,
    created_at
  )
  VALUES (
    p_event_id,
    NULLIF(p_draw_record->>'prize_id', '')::UUID,
    p_draw_record->>'prize_title',
    'drawn',
    p_draw_record->>'locked_ledger_hash',
    (p_draw_record->>'locked_at')::TIMESTAMPTZ,
    p_draw_record->>'draw_method',
    p_draw_record->>'provider_reference',
    (p_draw_record->>'drawn_at')::TIMESTAMPTZ,
    (p_draw_record->>'winning_player_id')::UUID,
    p_draw_record->>'winning_public_player_label',
    (p_draw_record->>'selected_weighted_entry_index')::INTEGER,
    COALESCE(p_draw_record->'audit_metadata', '{}'::jsonb),
    (p_draw_record->>'created_at')::TIMESTAMPTZ
  )
  RETURNING * INTO v_inserted;

  UPDATE public.drawing_ledger_locks
  SET status = 'drawn', updated_at = now()
  WHERE event_id = p_event_id
    AND status = v_lock_status
    AND status = ANY(p_allowed_statuses);

  RETURN NEXT v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_prize_draws_if_publishable(
  p_event_id UUID,
  p_allowed_statuses TEXT[],
  p_published_at TIMESTAMPTZ
)
RETURNS SETOF public.prize_draw_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_status TEXT;
BEGIN
  SELECT status INTO v_lock_status
  FROM public.drawing_ledger_locks
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF v_lock_status IS NULL THEN
    RAISE EXCEPTION 'Drawing ledger lock not found for event %.', p_event_id;
  END IF;

  IF v_lock_status = 'cancelled'
    OR NOT (v_lock_status = ANY(p_allowed_statuses))
    OR v_lock_status != 'drawn' THEN
    RAISE EXCEPTION 'Cannot publish prize draw for event %. Ledger status % is not publishable.', p_event_id, v_lock_status;
  END IF;

  UPDATE public.drawing_ledger_locks
  SET status = 'published', updated_at = now()
  WHERE event_id = p_event_id
    AND status = v_lock_status
    AND status = ANY(p_allowed_statuses);

  RETURN QUERY
  UPDATE public.prize_draw_records
  SET status = 'published', published_at = p_published_at
  WHERE event_id = p_event_id
    AND status = 'drawn'
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_prize_draw_if_drawable(UUID, TEXT[], JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_prize_draws_if_publishable(UUID, TEXT[], TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_prize_draw_if_drawable(UUID, TEXT[], JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_prize_draws_if_publishable(UUID, TEXT[], TIMESTAMPTZ) TO service_role;

-- 4.6 Public Published Drawings Projection View
CREATE OR REPLACE VIEW public.public_published_drawings_projection
WITH (security_barrier = true) AS
SELECT
  pdr.id AS draw_record_id,
  pdr.event_id,
  pdr.prize_id,
  pdr.prize_title,
  pdr.winning_public_player_label AS winner_public_label,
  pdr.draw_method,
  pdr.provider_reference,
  pdr.drawn_at,
  pdr.published_at,
  pdr.locked_ledger_hash,
  COALESCE(pdr.audit_metadata->>'verificationStatus', CASE WHEN pdr.draw_method = 'manual_external' THEN 'manual_unverified' ELSE 'internal_seeded' END) AS verification_status,
  COALESCE((pdr.audit_metadata->>'isSystemVerified')::boolean, false) AS is_system_verified,
  COALESCE((pdr.audit_metadata->>'isIndependent')::boolean, false) AS is_independent,
  pdr.audit_metadata
FROM public.prize_draw_records pdr
WHERE pdr.status = 'published';

-- 4.7 Privacy & Minor-Safe Public Drawing Ledger Projection View
CREATE OR REPLACE VIEW public.public_drawing_ledger_projection
WITH (security_barrier = true) AS
SELECT
  del.event_id,
  CASE 
    WHEN COALESCE(p.is_minor, false) 
      OR p.display_name IS NULL 
      OR TRIM(p.display_name) = '' 
      OR p.display_name ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
      OR p.display_name ~ '\+?[0-9]{1,4}[-.\s]?\(?[0-9]{1,3}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{4}'
    THEN 'Agent #' || RIGHT(REPLACE(p.id::text, '-', ''), 4)
    WHEN TRIM(p.display_name) LIKE 'Agent #%' THEN p.display_name
    ELSE p.display_name
  END AS player_public_label,
  SUM(del.entries_count)::INT AS total_qualified_entries,
  COALESCE(dll.is_locked, false) AS is_locked,
  dll.locked_at
FROM public.drawing_entry_ledger del
JOIN public.players p ON del.player_id = p.id
LEFT JOIN public.drawing_ledger_locks dll ON del.event_id = dll.event_id
GROUP BY del.event_id, p.id, p.display_name, p.is_minor, dll.is_locked, dll.locked_at;

GRANT SELECT ON public.public_published_drawings_projection TO anon, authenticated;
GRANT SELECT ON public.public_drawing_ledger_projection TO anon, authenticated;


-- =============================================================================
-- SECTION 5: QR Campaign Attribution
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.qr_campaigns (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_flyer_variants (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.qr_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, name)
);

CREATE TABLE IF NOT EXISTS public.campaign_distributors (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.qr_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, name)
);

CREATE TABLE IF NOT EXISTS public.campaign_qr_codes (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.qr_campaigns(id) ON DELETE CASCADE,
  flyer_variant_id text NOT NULL REFERENCES public.campaign_flyer_variants(id) ON DELETE CASCADE,
  distributor_id text NOT NULL REFERENCES public.campaign_distributors(id) ON DELETE CASCADE,
  internal_name text NOT NULL,
  destination_url text NOT NULL,
  tracking_slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, flyer_variant_id, distributor_id)
);

CREATE TABLE IF NOT EXISTS public.campaign_visits (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.qr_campaigns(id) ON DELETE CASCADE,
  flyer_variant_id text NOT NULL REFERENCES public.campaign_flyer_variants(id) ON DELETE CASCADE,
  distributor_id text NOT NULL REFERENCES public.campaign_distributors(id) ON DELETE CASCADE,
  qr_code_id text NOT NULL REFERENCES public.campaign_qr_codes(id) ON DELETE CASCADE,
  destination_url text NOT NULL,
  anonymous_visitor_id text NOT NULL,
  referrer text,
  user_agent_class text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_flyers_campaign ON public.campaign_flyer_variants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_distributors_campaign ON public.campaign_distributors(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_qrs_campaign ON public.campaign_qr_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_qrs_slug_active ON public.campaign_qr_codes(tracking_slug, status);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_campaign_created ON public.campaign_visits(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_flyer ON public.campaign_visits(campaign_id, flyer_variant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_distributor ON public.campaign_visits(campaign_id, distributor_id);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_combination ON public.campaign_visits(qr_code_id, anonymous_visitor_id);

ALTER TABLE public.qr_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_flyer_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "GM admin manages qr campaigns" ON public.qr_campaigns;
CREATE POLICY "GM admin manages qr campaigns"
  ON public.qr_campaigns
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "GM admin manages campaign flyer variants" ON public.campaign_flyer_variants;
CREATE POLICY "GM admin manages campaign flyer variants"
  ON public.campaign_flyer_variants
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "GM admin manages campaign distributors" ON public.campaign_distributors;
CREATE POLICY "GM admin manages campaign distributors"
  ON public.campaign_distributors
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "GM admin manages campaign qr codes" ON public.campaign_qr_codes;
CREATE POLICY "GM admin manages campaign qr codes"
  ON public.campaign_qr_codes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "GM admin reads campaign visits" ON public.campaign_visits;
CREATE POLICY "GM admin reads campaign visits"
  ON public.campaign_visits
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

REVOKE ALL ON public.qr_campaigns FROM anon, authenticated;
REVOKE ALL ON public.campaign_flyer_variants FROM anon, authenticated;
REVOKE ALL ON public.campaign_distributors FROM anon, authenticated;
REVOKE ALL ON public.campaign_qr_codes FROM anon, authenticated;
REVOKE ALL ON public.campaign_visits FROM anon, authenticated;

-- Seed Canonical Street Team Campaign Data
DO $$
DECLARE
  v_campaign_id TEXT;
  v_variant_family_id TEXT;
  v_variant_challenge_id TEXT;
  v_variant_secret_id TEXT;
  v_dist_dustin_id TEXT;
  v_dist_emp1_id TEXT;
  v_dist_emp2_id TEXT;
BEGIN
  INSERT INTO public.qr_campaigns (id, name, slug, destination_url, description, notes, status)
  VALUES (
    'camp-street-team-2026',
    'Canton Quests Street Team 2026',
    'canton-quests-street-team-2026',
    '/quests',
    'Promotional QR flyer campaign distributed by the Canton street team across Canton, Ohio.',
    'Canonical street team campaign for flyers and short slugs.',
    'active'
  ) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    destination_url = EXCLUDED.destination_url,
    description = EXCLUDED.description,
    notes = EXCLUDED.notes,
    status = EXCLUDED.status;

  SELECT id INTO v_campaign_id FROM public.qr_campaigns WHERE slug = 'canton-quests-street-team-2026';

  INSERT INTO public.campaign_flyer_variants (id, campaign_id, name, description, notes, status)
  VALUES ('flyer-family', v_campaign_id, 'Family', 'All-ages family adventure flyer', 'Destination /start/family', 'active')
  ON CONFLICT (campaign_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    notes = EXCLUDED.notes,
    status = EXCLUDED.status;

  SELECT id INTO v_variant_family_id FROM public.campaign_flyer_variants WHERE campaign_id = v_campaign_id AND name = 'Family';

  INSERT INTO public.campaign_flyer_variants (id, campaign_id, name, description, notes, status)
  VALUES ('flyer-challenge', v_campaign_id, 'Challenge', 'Competitive squad challenge flyer', 'Destination /start/challenge', 'active')
  ON CONFLICT (campaign_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    notes = EXCLUDED.notes,
    status = EXCLUDED.status;

  SELECT id INTO v_variant_challenge_id FROM public.campaign_flyer_variants WHERE campaign_id = v_campaign_id AND name = 'Challenge';

  INSERT INTO public.campaign_flyer_variants (id, campaign_id, name, description, notes, status)
  VALUES ('flyer-secret', v_campaign_id, 'Secret', 'Unlisted mystery entry flyer', 'Destination /start/secret', 'active')
  ON CONFLICT (campaign_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    notes = EXCLUDED.notes,
    status = EXCLUDED.status;

  SELECT id INTO v_variant_secret_id FROM public.campaign_flyer_variants WHERE campaign_id = v_campaign_id AND name = 'Secret';

  INSERT INTO public.campaign_distributors (id, campaign_id, name, notes, status)
  VALUES ('dist-dustin', v_campaign_id, 'Dustin', 'Street team lead', 'active')
  ON CONFLICT (campaign_id, name) DO UPDATE SET
    notes = EXCLUDED.notes,
    status = EXCLUDED.status;

  SELECT id INTO v_dist_dustin_id FROM public.campaign_distributors WHERE campaign_id = v_campaign_id AND name = 'Dustin';

  INSERT INTO public.campaign_distributors (id, campaign_id, name, notes, status)
  VALUES ('dist-emp-1', v_campaign_id, 'Employee 1', 'Street team distributor 1', 'active')
  ON CONFLICT (campaign_id, name) DO UPDATE SET
    notes = EXCLUDED.notes,
    status = EXCLUDED.status;

  SELECT id INTO v_dist_emp1_id FROM public.campaign_distributors WHERE campaign_id = v_campaign_id AND name = 'Employee 1';

  INSERT INTO public.campaign_distributors (id, campaign_id, name, notes, status)
  VALUES ('dist-emp-2', v_campaign_id, 'Employee 2', 'Street team distributor 2', 'active')
  ON CONFLICT (campaign_id, name) DO UPDATE SET
    notes = EXCLUDED.notes,
    status = EXCLUDED.status;

  SELECT id INTO v_dist_emp2_id FROM public.campaign_distributors WHERE campaign_id = v_campaign_id AND name = 'Employee 2';

  INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
  VALUES
    ('cqr-canonical-f1', v_campaign_id, v_variant_family_id, v_dist_dustin_id, 'Canton Quests Street Team 2026 / Family / Dustin', '/start/family', 'f1', 'active'),
    ('cqr-canonical-f2', v_campaign_id, v_variant_family_id, v_dist_emp1_id, 'Canton Quests Street Team 2026 / Family / Employee 1', '/start/family', 'f2', 'active'),
    ('cqr-canonical-f3', v_campaign_id, v_variant_family_id, v_dist_emp2_id, 'Canton Quests Street Team 2026 / Family / Employee 2', '/start/family', 'f3', 'active'),
    ('cqr-canonical-c1', v_campaign_id, v_variant_challenge_id, v_dist_dustin_id, 'Canton Quests Street Team 2026 / Challenge / Dustin', '/start/challenge', 'c1', 'active'),
    ('cqr-canonical-c2', v_campaign_id, v_variant_challenge_id, v_dist_emp1_id, 'Canton Quests Street Team 2026 / Challenge / Employee 1', '/start/challenge', 'c2', 'active'),
    ('cqr-canonical-c3', v_campaign_id, v_variant_challenge_id, v_dist_emp2_id, 'Canton Quests Street Team 2026 / Challenge / Employee 2', '/start/challenge', 'c3', 'active'),
    ('cqr-canonical-s1', v_campaign_id, v_variant_secret_id, v_dist_dustin_id, 'Canton Quests Street Team 2026 / Secret / Dustin', '/start/secret', 's1', 'active'),
    ('cqr-canonical-s2', v_campaign_id, v_variant_secret_id, v_dist_emp1_id, 'Canton Quests Street Team 2026 / Secret / Employee 1', '/start/secret', 's2', 'active'),
    ('cqr-canonical-s3', v_campaign_id, v_variant_secret_id, v_dist_emp2_id, 'Canton Quests Street Team 2026 / Secret / Employee 2', '/start/secret', 's3', 'active')
  ON CONFLICT (tracking_slug) DO UPDATE SET
    campaign_id = EXCLUDED.campaign_id,
    flyer_variant_id = EXCLUDED.flyer_variant_id,
    distributor_id = EXCLUDED.distributor_id,
    internal_name = EXCLUDED.internal_name,
    destination_url = EXCLUDED.destination_url,
    status = EXCLUDED.status;
END $$;


-- =============================================================================
-- SECTION 6: Player Identity & Three-Path Architecture
-- =============================================================================

-- 6.1 Extend Players table with profile & path attribution fields
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS selected_starting_path TEXT DEFAULT 'family';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS acquisition_source TEXT DEFAULT 'main_site';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS hometown TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#f59e0b';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS favorite_style TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS selected_flair TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS showcase_badges TEXT[] DEFAULT '{}';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6.2 Extend Quests table with starting_path column
ALTER TABLE public.quests ADD COLUMN IF NOT EXISTS starting_path TEXT DEFAULT 'family';

-- 6.3 Achievements Catalog Table
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  badge_symbol TEXT NOT NULL,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL,
  district TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.4 Player Achievements Junction Table
CREATE TABLE IF NOT EXISTS public.player_achievements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  achievement_slug TEXT NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  provenance TEXT,
  CONSTRAINT unique_player_achievement UNIQUE (player_id, achievement_slug)
);

CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON public.player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_slug ON public.player_achievements(achievement_slug);
CREATE INDEX IF NOT EXISTS idx_quests_starting_path ON public.quests(starting_path);
CREATE INDEX IF NOT EXISTS idx_players_starting_path ON public.players(selected_starting_path);

-- 6.5 Seed Canonical Achievements
INSERT INTO public.achievements (id, slug, name, description, badge_symbol, category, rarity, district)
VALUES
  ('ach-pathfinder-family', 'pathfinder-family', 'Pathfinder: Family Adventure', 'Completed your first mission starting in the Downtown Arts district.', '🧭', 'path', 'common', 'family'),
  ('ach-pathfinder-challenge', 'pathfinder-challenge', 'Pathfinder: Kinetic Challenge', 'Completed your first mission starting in the Challenge district.', '⚡', 'path', 'common', 'challenge'),
  ('ach-pathfinder-secret', 'pathfinder-secret', 'Pathfinder: Secret Mystery', 'Completed your first mission starting in the Mystery & Memorial district.', '🗝️', 'path', 'common', 'secret'),
  ('ach-district-sweep-family', 'district-sweep-family', 'District Sweep: Arts & Downtown', 'Completed all active missions in the Downtown Arts district.', '🎨', 'district', 'rare', 'family'),
  ('ach-district-sweep-challenge', 'district-sweep-challenge', 'District Sweep: Athletic & Skill', 'Completed all active missions in the Challenge district.', '🏆', 'district', 'rare', 'challenge'),
  ('ach-district-sweep-secret', 'district-sweep-secret', 'District Sweep: Mystery & Memorial', 'Completed all active missions in the Secret district.', '📜', 'district', 'rare', 'secret'),
  ('ach-triple-threat', 'triple-threat', 'Triple Threat', 'Completed qualifying missions across all three Canton districts (Family, Challenge, and Secret).', '🔱', 'exploration', 'epic', NULL),
  ('ach-nomad', 'nomad', 'City Nomad', 'Completed qualifying missions across all three districts within the same event day.', '🌐', 'exploration', 'epic', NULL),
  ('ach-day-one-king', 'day-one-king', 'Day 1 City Conqueror', 'Finished Day 1 ranked #1 in XP on the official individual leaderboard (+5 Prize Entries).', '👑', 'competitive', 'legendary', NULL)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  badge_symbol = EXCLUDED.badge_symbol,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  district = EXCLUDED.district;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Achievements catalog is publicly readable" ON public.achievements;
CREATE POLICY "Achievements catalog is publicly readable"
  ON public.achievements FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Player achievements are publicly readable" ON public.player_achievements;
CREATE POLICY "Player achievements are publicly readable"
  ON public.player_achievements FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages player achievements" ON public.player_achievements;
CREATE POLICY "Service role manages player achievements"
  ON public.player_achievements FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');


-- =============================================================================
-- SECTION 7: Critical Player Authentication & Identity Hardening
-- (Enforced here to guarantee that the final state matches 20260814010000)
-- =============================================================================

-- 7.1 Ensure unique constraint on user_id for players
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_user_id_unique
  ON public.players(user_id)
  WHERE user_id IS NOT NULL;

-- 7.2 Index for case-insensitive email lookup during safe legacy account claiming
CREATE INDEX IF NOT EXISTS idx_players_email_lower
  ON public.players(LOWER(email))
  WHERE email IS NOT NULL;

-- 7.3 Trigger Function: Prevent altering players.user_id once claimed (unless service_role)
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

-- 7.4 Authoritative, Hardened Row Level Security Policies on Players
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Player profiles viewable by everyone" ON public.players;
DROP POLICY IF EXISTS "Players viewable by everyone" ON public.players;
DROP POLICY IF EXISTS "Players can view all profiles" ON public.players;
CREATE POLICY "Player profiles viewable by everyone"
  ON public.players FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own player profile" ON public.players;
DROP POLICY IF EXISTS "Players can insert own profile" ON public.players;
CREATE POLICY "Users can insert their own player profile"
  ON public.players
  FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id) OR
    (auth.jwt() ->> 'role' = 'service_role')
  );

DROP POLICY IF EXISTS "Users can update their own player profile" ON public.players;
DROP POLICY IF EXISTS "Players can update own profile" ON public.players;
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

-- 7.5 Hardened Quest Submission RLS Policy: Only authenticated player or service_role can submit proofs
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

GRANT SELECT, INSERT, UPDATE ON public.players TO authenticated;
GRANT SELECT ON public.players TO anon;


-- =============================================================================
-- SECTION 8: Canonical Canton Quests Volume 1 Production Data Restoration
-- =============================================================================

DO $$
DECLARE
  v_city_id UUID;
  v_event_id UUID;
  v_secret_quest_id UUID;
  v_col_founder UUID;
  v_col_palace UUID;
BEGIN
  -- 8.1 Restore City: Canton, Ohio
  INSERT INTO public.cities (id, name, slug, state, is_active, created_at)
  VALUES (
    'a0000001-0000-4000-8000-000000000001'::uuid,
    'Canton',
    'canton-oh',
    'OH',
    true,
    '2026-08-01T00:00:00Z'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    state = EXCLUDED.state,
    is_active = EXCLUDED.is_active;

  SELECT id INTO v_city_id FROM public.cities WHERE slug = 'canton-oh';

  -- 8.2 Restore Canonical Launch Locations (9 Locations)
  INSERT INTO public.locations (
    id, city_id, name, address, latitude, longitude,
    location_notes, is_partner, radius_meters, access_notes, opening_hours, created_at
  )
  VALUES
    (
      'c0000001-0000-4000-8000-000000000001'::uuid,
      v_city_id,
      'Centennial Plaza',
      '330 Market Ave N, Canton, OH 44702',
      40.7989,
      -81.3748,
      'Downtown Canton central gathering space with outdoor screens and cafe seating.',
      true,
      60,
      'Open public plaza 6:00 AM – 11:00 PM daily. High pedestrian zone.',
      '6:00 AM - 11:00 PM',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000002'::uuid,
      v_city_id,
      'McKinley National Memorial',
      '800 McKinley Monument Dr NW, Canton, OH 44708',
      40.8064,
      -81.3933,
      'Historic 108-step monument overlooking the park and city.',
      false,
      80,
      'Park grounds open dawn to dusk. Stairway can be slick in rainy weather.',
      'Dawn - Dusk',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000003'::uuid,
      v_city_id,
      '4th Street Arts Corridor Mural',
      '4th St NW & Court Ave NW, Canton, OH 44702',
      40.7995,
      -81.3755,
      'Vibrant street art wall in the heart of downtown Canton Arts District.',
      true,
      50,
      'Public sidewalk access 24/7. Watch for downtown vehicular traffic.',
      '24/7 Public Access',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000004'::uuid,
      v_city_id,
      'Aura Craft Coffee',
      '414 4th St NW, Canton, OH 44702',
      40.7998,
      -81.3761,
      'Local partner coffee shop. Look near the espresso counter or patio area.',
      true,
      40,
      'Indoor scanning during business hours (7 AM - 6 PM M-S). Patio access 24/7.',
      '7:00 AM - 6:00 PM',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000005'::uuid,
      v_city_id,
      'Downtown Canton Arcade Vault',
      '218 Market Ave N, Canton, OH 44702',
      40.7978,
      -81.3748,
      'Retro arcade venue featuring vintage pinball and arcade cabinets.',
      true,
      40,
      'Family friendly hours 12 PM - 8 PM.',
      '12:00 PM - 10:00 PM',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000006'::uuid,
      v_city_id,
      'Canton Palace Theatre',
      '605 Market Ave N, Canton, OH 44702',
      40.8012,
      -81.3748,
      'Historic theater marquee and architectural gem of Canton.',
      true,
      50,
      'Marquee visible from sidewalk 24/7.',
      '24/7 Outdoor Access',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000007'::uuid,
      v_city_id,
      'Hall of Fame City Marker',
      '2121 George Halas Dr NW, Canton, OH 44708',
      40.8211,
      -81.3985,
      'Commemorative plaza marker celebrating Canton football heritage.',
      false,
      75,
      'Outdoor trail plaza open daily.',
      'Dawn - Dusk',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000008'::uuid,
      v_city_id,
      'The Onesto Historic Entrance',
      '225 2nd St NW, Canton, OH 44702',
      40.7971,
      -81.3752,
      'Grand historic hotel building with ornate brass entrance doors.',
      false,
      45,
      'Public sidewalk view.',
      '24/7',
      '2026-08-01T00:00:00Z'
    ),
    (
      'c0000001-0000-4000-8000-000000000009'::uuid,
      v_city_id,
      'Frankenstein Monument at West Lawn Cemetery',
      '1919 7th St NW, Canton, OH 44708',
      NULL,
      NULL,
      'Human field verification required before launch: confirm exact monument location, cemetery visitor rules, and any photography restrictions with West Lawn Cemetery staff.',
      false,
      60,
      'Daylight cemetery visit only during posted visitor hours. Stay on cemetery paths and roads, keep voices low, and never touch, climb, lean on, decorate, or disturb graves, monuments, markers, flowers, or memorial items.',
      'Posted visitor hours only; daylight access. Gates may close earlier in winter. Reconfirm before launch.',
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (id) DO UPDATE SET
    city_id = EXCLUDED.city_id,
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    location_notes = EXCLUDED.location_notes,
    is_partner = EXCLUDED.is_partner,
    radius_meters = EXCLUDED.radius_meters,
    access_notes = EXCLUDED.access_notes,
    opening_hours = EXCLUDED.opening_hours;

  -- 8.3 Restore Canonical Volume 1 Event: The Founder's Cipher
  INSERT INTO public.events (
    id, city_id, title, slug, description, status, current_phase, is_paused,
    start_time, end_time, registration_start_time, basic_instructions,
    safety_notes, map_center_lat, map_center_lon, theme_color, readiness_status, created_at
  )
  VALUES (
    'b0000001-0000-4000-8000-000000000001'::uuid,
    v_city_id,
    'Canton Quests: Volume 1 - The Founder''s Cipher',
    'canton-weekend-1',
    'A real-world Canton adventure of founder marks, hidden field signals, public art, history nodes, partner stops, and one respectful cemetery mystery.',
    'active',
    'day_1',
    false,
    '2026-09-11T18:00:00Z',
    '2026-09-14T22:00:00Z',
    '2026-08-15T00:00:00Z',
    '1. Choose a mission from the board.' || E'\n' ||
    '2. Travel only to public or partner-approved places during posted hours.' || E'\n' ||
    '3. Use the on-site clue, QR, photo, or GPS check to submit proof.' || E'\n' ||
    '4. Earn XP and drawing entries, then check progress and the leaderboard.',
    'Use marked crosswalks, obey posted hours, avoid private property, and skip any location that feels unsafe or unavailable. Cemetery quests are daylight-only and require respectful conduct.',
    40.7989,
    -81.3748,
    '#f5b942',
    'ready',
    '2026-08-01T00:00:00Z'
  )
  ON CONFLICT (slug) DO UPDATE SET
    city_id = EXCLUDED.city_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    current_phase = EXCLUDED.current_phase,
    is_paused = EXCLUDED.is_paused,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    registration_start_time = EXCLUDED.registration_start_time,
    basic_instructions = EXCLUDED.basic_instructions,
    safety_notes = EXCLUDED.safety_notes,
    map_center_lat = EXCLUDED.map_center_lat,
    map_center_lon = EXCLUDED.map_center_lon,
    theme_color = EXCLUDED.theme_color,
    readiness_status = EXCLUDED.readiness_status;

  SELECT id INTO v_event_id FROM public.events WHERE slug = 'canton-weekend-1';

  -- 8.4 Restore Canonical Collectibles (5 Collectibles)
  INSERT INTO public.collectibles (id, name, slug, description, badge_symbol, rarity, created_at)
  VALUES
    (
      'd0000001-0000-4000-8000-000000000001'::uuid,
      'Founder Token',
      'founder-token',
      'Awarded to agents who crack the Founder Cipher at Centennial Plaza.',
      '🏅',
      'common',
      '2026-08-01T00:00:00Z'
    ),
    (
      'd0000001-0000-4000-8000-000000000002'::uuid,
      'Cipher Fragment Alpha',
      'cipher-fragment-1',
      'First piece of the 3-part Canton Master Cipher.',
      '🧩',
      'rare',
      '2026-08-01T00:00:00Z'
    ),
    (
      'd0000001-0000-4000-8000-000000000003'::uuid,
      'Cipher Fragment Beta',
      'cipher-fragment-2',
      'Second piece of the 3-part Canton Master Cipher.',
      '🧩',
      'rare',
      '2026-08-01T00:00:00Z'
    ),
    (
      'd0000001-0000-4000-8000-000000000004'::uuid,
      'Cipher Fragment Gamma',
      'cipher-fragment-3',
      'Final piece of the 3-part Canton Master Cipher.',
      '🧩',
      'legendary',
      '2026-08-01T00:00:00Z'
    ),
    (
      'd0000001-0000-4000-8000-000000000005'::uuid,
      'Palace Theatre Golden Seal',
      'palace-seal',
      'Historic seal granted for completing the Palace Theatre marquee lore.',
      '👑',
      'legendary',
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    badge_symbol = EXCLUDED.badge_symbol,
    rarity = EXCLUDED.rarity;

  SELECT id INTO v_col_founder FROM public.collectibles WHERE slug = 'founder-token';
  SELECT id INTO v_col_palace FROM public.collectibles WHERE slug = 'palace-seal';

  -- 8.5 Restore Canonical Volume 1 Quests (15 Quests)
  INSERT INTO public.quests (
    id, event_id, location_id, title, slug, description, instructions,
    point_value, xp_reward, drawing_entry_reward, difficulty, category,
    verification_type, target_code, proof_requirement, is_flash, starts_at, expires_at,
    status, sort_order, radius_meters, prerequisite_quest_id, unlock_condition_type,
    require_location_verification, require_qr_and_location, claim_limit, current_claims,
    is_secret, is_finale_quest, gm_notes, safety_notes, starting_path, created_at
  )
  VALUES
    (
      'e0000001-0000-4000-8000-000000000001'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'Open the Founder Signal',
      'centennial-beacon',
      'Begin Volume 1 at Centennial Plaza, where the Founder Cipher first lights up the city grid.',
      'Go to Centennial Plaza, stand in the public plaza area, and verify your location to activate your field log.',
      75, 75, 1, 'easy', 'exploration',
      'checkin', NULL, 'GPS check-in from the public plaza area.', false, NULL, NULL,
      'active', 1, 60, NULL, 'none',
      true, false, NULL, 0,
      false, false,
      'Field verify plaza access on launch weekend and place opening signage where it does not obstruct pedestrian flow.',
      'Use public sidewalks and plaza areas. Do not enter closed event setups, stages, or restricted maintenance areas.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000002'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000002'::uuid,
      'The Stone Stair Cipher',
      'mckinley-monument-year',
      'The monument stairs guard a dated marker. Read the site itself and recover the four digits.',
      'Visit the public memorial grounds during open hours. Find the relevant dedication marker near the monument approach and enter the four-digit year requested by the quest.',
      150, 150, 1, 'medium', 'puzzle',
      'passphrase', 'sha256:0e3c49c57d4ab2494d55671730c356687405eb0423cc755381399f2f431b2d16', 'Enter the four-digit year found on the physical marker identified by the quest.', false, NULL, NULL,
      'active', 2, 80, NULL, 'none',
      true, false, NULL, 0,
      false, false,
      'Existing server hash expects the verified four-digit answer. Reconfirm plaque wording and target marker before printing clue cards.',
      'Daylight recommended. Stairs may be slick; players do not need to climb quickly or leave public paths.',
      'secret', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000003'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000003'::uuid,
      'The Painted Witness',
      '4th-st-mural-pose',
      'The Arts District keeps a visual clue in plain sight. Capture your team with the city color behind you.',
      'Stand on the public sidewalk near the mural and take a respectful photo of your team or callsign card with the mural visible.',
      175, 175, 1, 'medium', 'creative',
      'photo', NULL, 'Upload a photo or proof link showing the mural and your team/callsign card.', false, NULL, NULL,
      'active', 3, 50, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Manual review should verify the mural is visible and the proof appears original to the event window.',
      'Stay on sidewalks, keep storefront entrances clear, and watch traffic when crossing downtown streets.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000004'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000004'::uuid,
      'The Counter-Sign at Aura',
      'aura-coffee-scan',
      'A partner signal is waiting at the coffee counter. No purchase required.',
      'During posted business hours, find the official Canton Quests QR card at Aura Craft Coffee and enter the printed QR passcode.',
      125, 125, 1, 'easy', 'business_partner',
      'qr', 'sha256:a3cd92f342c2b4d31e2025bd95b19b10ed3f996b3360dcfd57fe3233767ac8c9', 'Enter the QR passcode displayed on the official Canton Quests card.', false, NULL, NULL,
      'active', 4, 40, NULL, 'none',
      false, true, NULL, 0,
      false, false,
      'Requires partner permission, final QR placement, and free no-purchase access path before launch.',
      'Visit only during partner-approved hours, respect staff and customers, and do not block the counter.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000005'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000005'::uuid,
      'The Neon Victory Loop',
      'arcade-champion-video',
      'A partner-ready media quest slot for an all-ages arcade or game venue.',
      'If the partner site is confirmed active, record a short celebration clip near the approved game area. If the site is not staffed or approved, skip this mission.',
      250, 250, 2, 'hard', 'photo_video',
      'video', NULL, 'Upload a short video or proof link from the approved partner area.', false, NULL, NULL,
      'active', 5, 40, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Partner-ready slot. Confirm venue name, hours, minor policy, and exact proof backdrop before activation.',
      'Partner permission required. Family-friendly hours only; no alcohol purchase or adult-only access may be required.',
      'challenge', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000006'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000006'::uuid,
      'The Palace Lantern Date',
      'palace-theatre-lore',
      'The Palace Theatre facade holds a date tied to Canton show-night lore.',
      'From the public sidewalk, inspect the approved exterior marker and enter the four-digit year requested by this quest.',
      125, 125, 1, 'easy', 'trivia',
      'passphrase', 'sha256:3d5d2c29712a98874d8142d229c4bce09158a144ad376c2b68411f240878a9c1', 'Enter the four-digit year from the approved exterior marker.', false, NULL, NULL,
      'active', 6, 50, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Existing server hash expects the verified four-digit answer. Reconfirm marker text before launch.',
      'Stay on public sidewalks and keep theatre entrances clear. No ticket purchase is required.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000007'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'Flash Drop: Market Square Signal',
      'market-square-flash',
      'A live signal can be activated by the Game Master during the event window.',
      'When the Game Master broadcasts this drop, go to Centennial Plaza and verify your public-plaza location before the timer expires.',
      225, 225, 2, 'medium', 'flash',
      'checkin', NULL, 'Timed GPS check-in during an active Game Master flash window.', true, '2026-09-12T19:00:00Z', '2026-09-12T19:45:00Z',
      'active', 7, 60, NULL, 'none',
      true, false, NULL, 0,
      false, false,
      'Use live controls to adjust the active window based on weather and field conditions.',
      'No running into traffic or cutting through restricted areas. The drop is optional and should be paused if the plaza is crowded or closed.',
      'cross_city', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000008'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000008'::uuid,
      'The Brass Door Key',
      'onesto-brass-motto',
      'A downtown doorway hides a one-word key in its architectural details.',
      'From the public sidewalk, inspect the approved entrance detail and enter the single word identified by the field clue.',
      150, 150, 1, 'medium', 'observation',
      'passphrase', 'sha256:1d3c51271f477ae14e45c93c4de9d71c88e659ec9df9ac491b917fcbee0987eb', 'Enter the exact word from the approved public-facing architectural detail.', false, NULL, NULL,
      'active', 8, 45, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Reconfirm visible clue target and public viewing boundary before launch.',
      'Public sidewalk view only. Do not enter private residential or lobby areas unless invited by posted public access.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000009'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000007'::uuid,
      'The Helmet Trail Emblem',
      'hof-trail-emblem',
      'A football-heritage route can host a high-value QR signal once field placement is confirmed.',
      'Find the official Canton Quests QR emblem at the approved public trail/plaza marker and enter its passcode.',
      325, 325, 2, 'hard', 'trivia',
      'qr', 'sha256:e5ec5382a5c868db291798d6f727c21b8b2e6e589a09849c8dbf4c5e981a24bd', 'Enter the QR passcode from the official field emblem.', false, NULL, NULL,
      'active', 9, 75, NULL, 'none',
      false, true, NULL, 0,
      false, false,
      'Human verification required for exact placement, permission, QR weatherproofing, and pedestrian safety.',
      'Use marked pedestrian routes and daylight hours. Do not cross traffic outside crosswalks.',
      'challenge', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000010'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000009'::uuid,
      'Frankenstein''s Quiet Signal',
      'frankenstein-quiet-signal',
      'A cemetery monument becomes a hushed field node. Find it respectfully, document your visit, and leave the place exactly as you found it.',
      'Visit West Lawn Cemetery only during posted public visiting hours. From a path or respectful standing distance, take one quiet photo that shows your callsign card near the Frankenstein monument area without touching or disturbing any grave or memorial.',
      300, 300, 2, 'hard', 'observation',
      'photo', NULL, 'Upload a respectful daytime photo or proof link showing your callsign card and the monument area from a safe distance.', false, NULL, NULL,
      'active', 10, 60, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Human verification required before launch: exact monument coordinates, cemetery hours/rules, photography policy, staff permission if needed, and whether this should be enabled or temporarily hidden.',
      'Daylight only. Confirm cemetery hours before visiting. No touching, climbing, rubbing, decorating, moving items, loud behavior, nighttime access, trespassing, or interference with graves, markers, services, visitors, or staff.',
      'secret', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000011'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000003'::uuid,
      'Secret Quest: The Founder''s Three Locks',
      'secret-cipher-77',
      'A higher-difficulty mystery chain begins when three downtown fragments start speaking to each other.',
      'Solve the three locks in order. Each lock uses a clue fragment gathered from a completed downtown mission; the next lock opens only after the previous one verifies.',
      650, 650, 4, 'epic', 'secret',
      'multi_step', 'sha256:aaa637bb2b24bc3e307a3201e22c694cdc4566365c991ccd64fa93bae23f3996', 'Verify all three field-fragment passphrases in sequence.', false, NULL, NULL,
      'active', 11, 50, 'e0000001-0000-4000-8000-000000000008'::uuid, 'prerequisite',
      false, false, NULL, 0,
      true, false,
      'Do not publish fragment answers. Confirm all three fragment cards are placed, ordered, and mapped to server step hashes before enabling this chain for competitive play.',
      'Use only public sidewalks and approved partner/public spaces while gathering fragments.',
      'secret', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000012'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'The Founder''s Keystone',
      'founders-secret-clue',
      'The opening signal reveals a second mark at the plaza.',
      'After opening the Founder Signal, inspect the approved public clue card or marker at Centennial Plaza and enter the keystone word.',
      150, 150, 1, 'medium', 'puzzle',
      'passphrase', 'sha256:036b0ec8125ea4188177e958f876254c06724168970a02060c29551e083595c6', 'Enter the keystone word from the approved physical clue.', false, NULL, NULL,
      'active', 12, 60, 'e0000001-0000-4000-8000-000000000001'::uuid, 'prerequisite',
      true, false, NULL, 0,
      false, false,
      'Server hash expects launch clue value. Place clue card only after final field route check.',
      'Stay in public plaza areas and do not move or alter any clue card or fixture.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000013'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000006'::uuid,
      'Flash Drop: Palace Lantern Cipher',
      'palace-marquee-flash',
      'A timed theatre-front cipher for the Game Master to activate during safe evening visibility.',
      'When activated, inspect the approved public-facing Palace clue and enter the flash passcode before the timer expires.',
      275, 275, 2, 'hard', 'flash',
      'passphrase', 'sha256:e49c9702b08e49280244ca823d1a747df7a3386f0cc67a990a6e5fd9094c6a70', 'Enter flash passcode before expiry.', true, '2026-09-12T23:00:00Z', '2026-09-12T23:30:00Z',
      'active', 13, 50, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Evening flash is optional. Cancel if weather, crowding, or lighting creates field risk.',
      'Only activate if the sidewalk is well lit, public, and calm. No road crossings outside marked crosswalks and no building entry required.',
      'cross_city', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000014'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'The Civic Seal Snapshot',
      'civic-seal-snapshot',
      'A family-friendly photo stop that turns the city center into a team badge moment.',
      'Find an approved public civic backdrop near the plaza and take a photo of your team/callsign card making a clear Canton Quests victory mark.',
      125, 125, 1, 'easy', 'creative',
      'photo', NULL, 'Upload a photo or proof link from the approved public civic backdrop.', false, NULL, NULL,
      'active', 14, 60, NULL, 'none',
      false, false, NULL, 0,
      false, false,
      'Pick final backdrop after human site walk; avoid exposing private business entrances or minors in public recap feeds.',
      'Keep sidewalks clear and do not photograph strangers closely without consent.',
      'family', '2026-08-01T00:00:00Z'
    ),
    (
      'e0000001-0000-4000-8000-000000000015'::uuid,
      v_event_id,
      'c0000001-0000-4000-8000-000000000001'::uuid,
      'Finale: The Founder''s Master Key',
      'grand-finale-cipher',
      'The final lock opens only when the Game Master starts the finale sprint.',
      'Qualified players receive the final prompt during Finale Mode. Enter the master key announced through official event channels.',
      900, 900, 5, 'epic', 'finale',
      'passphrase', 'sha256:8a2199b47b3f30d63a023f8dcfc82edc66bf863b3b23189703224923ad25c56f', 'Finale qualification and official Game Master prompt required.', false, NULL, NULL,
      'active', 15, 60, NULL, 'manual',
      false, false, NULL, 0,
      false, true,
      'Keep inactive until finale operations are staffed. Confirm drawing ledger status before awarding final entries.',
      'Finale prompt must never require rushing, trespassing, unsafe driving, or nighttime cemetery access.',
      'cross_city', '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (event_id, slug) DO UPDATE SET
    location_id = EXCLUDED.location_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    instructions = EXCLUDED.instructions,
    point_value = EXCLUDED.point_value,
    xp_reward = EXCLUDED.xp_reward,
    drawing_entry_reward = EXCLUDED.drawing_entry_reward,
    difficulty = EXCLUDED.difficulty,
    category = EXCLUDED.category,
    verification_type = EXCLUDED.verification_type,
    target_code = EXCLUDED.target_code,
    proof_requirement = EXCLUDED.proof_requirement,
    is_flash = EXCLUDED.is_flash,
    starts_at = EXCLUDED.starts_at,
    expires_at = EXCLUDED.expires_at,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    radius_meters = EXCLUDED.radius_meters,
    prerequisite_quest_id = EXCLUDED.prerequisite_quest_id,
    unlock_condition_type = EXCLUDED.unlock_condition_type,
    require_location_verification = EXCLUDED.require_location_verification,
    require_qr_and_location = EXCLUDED.require_qr_and_location,
    is_secret = EXCLUDED.is_secret,
    is_finale_quest = EXCLUDED.is_finale_quest,
    gm_notes = EXCLUDED.gm_notes,
    safety_notes = EXCLUDED.safety_notes,
    starting_path = EXCLUDED.starting_path;

  SELECT id INTO v_secret_quest_id FROM public.quests WHERE event_id = v_event_id AND slug = 'secret-cipher-77';

  -- 8.6 Restore Quest Steps for Multi-Step Quest 'Secret Quest: The Founder''s Three Locks'
  INSERT INTO public.quest_steps (
    id, quest_id, step_order, title, instructions, verification_type, target_code, location_id, radius_meters, created_at
  )
  VALUES
    (
      'f0000001-0000-4000-8000-000000000001'::uuid,
      v_secret_quest_id,
      1,
      'Lock One: Founder Fragment',
      'Use the fragment revealed by the Founder Signal route. Enter only the field phrase printed on the approved physical clue.',
      'passphrase',
      'sha256:be562e8a568bb4e0d791bca32216ff5ab972809bee874b937820e267f1e27106',
      'c0000001-0000-4000-8000-000000000001'::uuid,
      60,
      '2026-08-01T00:00:00Z'
    ),
    (
      'f0000001-0000-4000-8000-000000000002'::uuid,
      v_secret_quest_id,
      2,
      'Lock Two: Painted Fragment',
      'Use the fragment connected to the Painted Witness. Enter the field phrase exactly as it appears in the event clue.',
      'passphrase',
      'sha256:a0075b8e48f2cb31f4d2dc97a9c7326856d300fe0a733099686390f4ae4d632d',
      'c0000001-0000-4000-8000-000000000003'::uuid,
      50,
      '2026-08-01T00:00:00Z'
    ),
    (
      'f0000001-0000-4000-8000-000000000003'::uuid,
      v_secret_quest_id,
      3,
      'Lock Three: Brass Fragment',
      'Use the final fragment from the Brass Door Key. Enter the field phrase to close the chain and claim the mystery reward.',
      'passphrase',
      'sha256:3a5272225a330aba73b7dd79c961313b53c7dbb5dd75d6376505ee2bf5d8403c',
      'c0000001-0000-4000-8000-000000000008'::uuid,
      45,
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (quest_id, step_order) DO UPDATE SET
    title = EXCLUDED.title,
    instructions = EXCLUDED.instructions,
    verification_type = EXCLUDED.verification_type,
    target_code = EXCLUDED.target_code,
    location_id = EXCLUDED.location_id,
    radius_meters = EXCLUDED.radius_meters;

  -- 8.7 Restore Canonical Secret Codes (2 Codes)
  INSERT INTO public.secret_codes (
    id, event_id, code, description, bonus_points, max_redemptions, current_redemptions, is_active, grant_collectible_id, created_at
  )
  VALUES
    (
      '50000001-0000-4000-8000-000000000001'::uuid,
      v_event_id,
      'sha256:67a9464364c6f818e5ee997ee0a2b4ce41132639b4498d2a8ceedf70b0d90834',
      'Game Master Opening Broadcast Code',
      150, 50, 0, true,
      v_col_founder,
      '2026-08-07T18:00:00Z'
    ),
    (
      '50000001-0000-4000-8000-000000000002'::uuid,
      v_event_id,
      'sha256:02afa6fe2b15c793aad3c73636cbc91539816da99dc43144712b3bf405933eca',
      'Handed out by roaming NPC "The Courier" near Arts District',
      200, 15, 0, true,
      v_col_palace,
      '2026-08-07T19:30:00Z'
    )
  ON CONFLICT (event_id, code) DO UPDATE SET
    description = EXCLUDED.description,
    bonus_points = EXCLUDED.bonus_points,
    max_redemptions = EXCLUDED.max_redemptions,
    is_active = EXCLUDED.is_active,
    grant_collectible_id = EXCLUDED.grant_collectible_id;

  -- 8.8 Restore Canonical NPC Character: The Courier
  INSERT INTO public.npc_characters (
    id, event_id, alias_name, description, avatar_symbol, is_active, current_zone, clue_hint, secret_code, operator_notes, last_spotted_at
  )
  VALUES (
    '60000001-0000-4000-8000-000000000001'::uuid,
    v_event_id,
    'The Courier',
    'A mysterious agent roaming downtown Canton handing out secret passphrase cards.',
    '🕵️',
    true,
    '4th Street Arts Corridor',
    'Look near the giant street mural or Aura Craft Coffee patio.',
    'Distributed in person by The Courier',
    'Street team NPC for Arts District corridor',
    '2026-08-01T00:00:00Z'
  )
  ON CONFLICT (id) DO UPDATE SET
    alias_name = EXCLUDED.alias_name,
    description = EXCLUDED.description,
    avatar_symbol = EXCLUDED.avatar_symbol,
    is_active = EXCLUDED.is_active,
    current_zone = EXCLUDED.current_zone,
    clue_hint = EXCLUDED.clue_hint,
    secret_code = EXCLUDED.secret_code,
    operator_notes = EXCLUDED.operator_notes;

  -- 8.9 Restore Canonical Business Partners (2 Partners)
  INSERT INTO public.business_partners (
    id, city_id, name, address, contact_notes, public_instructions, is_active, created_at
  )
  VALUES
    (
      '70000001-0000-4000-8000-000000000001'::uuid,
      v_city_id,
      'Aura Craft Coffee',
      '414 4th St NW, Canton, OH 44702',
      'Partner coffee shop providing QR card placement and perk discounts.',
      'Show completed quest screen at counter for 10% off espresso drinks!',
      true,
      '2026-08-01T00:00:00Z'
    ),
    (
      '70000001-0000-4000-8000-000000000002'::uuid,
      v_city_id,
      'Downtown Canton Arcade Vault',
      '218 Market Ave N, Canton, OH 44702',
      'Arcade venue partner.',
      'Show completed quest screen for 5 free game tokens!',
      true,
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (id) DO UPDATE SET
    city_id = EXCLUDED.city_id,
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    contact_notes = EXCLUDED.contact_notes,
    public_instructions = EXCLUDED.public_instructions,
    is_active = EXCLUDED.is_active;

  -- 8.10 Restore Canonical Event Prizes (2 Prizes)
  INSERT INTO public.event_prizes (
    id, event_id, title, sponsor_name, quantity, eligibility_rule, sort_order, created_at
  )
  VALUES
    (
      '80000001-0000-4000-8000-000000000001'::uuid,
      v_event_id,
      '🏆 Canton Quest Champion Trophy & $100 Local Gift Pass',
      'Downtown Canton Partnership',
      1,
      'Highest overall XP score at Finale',
      1,
      '2026-08-01T00:00:00Z'
    ),
    (
      '80000001-0000-4000-8000-000000000002'::uuid,
      v_event_id,
      '☕ Year of Aura Coffee VIP Pass',
      'Aura Craft Coffee',
      1,
      'Winner of Business Partner Trail Challenge',
      2,
      '2026-08-01T00:00:00Z'
    )
  ON CONFLICT (id) DO UPDATE SET
    event_id = EXCLUDED.event_id,
    title = EXCLUDED.title,
    sponsor_name = EXCLUDED.sponsor_name,
    quantity = EXCLUDED.quantity,
    eligibility_rule = EXCLUDED.eligibility_rule,
    sort_order = EXCLUDED.sort_order;

  -- 8.11 Ensure Open Drawing Ledger Lock Record Exists
  INSERT INTO public.drawing_ledger_locks (event_id, is_locked, status, created_at, updated_at)
  VALUES (
    v_event_id,
    false,
    'open',
    '2026-08-01T00:00:00Z',
    '2026-08-01T00:00:00Z'
  )
  ON CONFLICT (event_id) DO NOTHING;

END $$;
