-- Canton Quests Phase 5.1 Spectator Participation Engine & Safety Foundation Migration
-- Migration: 20260809400000_phase5_spectator_engine.sql

-- 1. Audience Events Table (Supports all GM controls & overrides)
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

-- Partial Unique Index: Prevent simultaneous active audience events for the same event
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_audience_event
ON public.audience_events (event_id)
WHERE (status = 'voting_active');

-- 1b. Public Audience Events View (Sanitizes internal admin IDs, target secrets, and manual override notes)
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

-- 2. Audience Event Options Table (Internal DB Table containing effect_payload)
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

-- 2b. Public Audience Event Options View (Masks effect_payload AND restricts to active/resolved events)
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

-- 3. Audience Votes Table (Server-Mediated & Strictly Limited)
CREATE TABLE IF NOT EXISTS public.audience_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audience_event_id UUID NOT NULL REFERENCES public.audience_events(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.audience_event_options(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL,
    vote_number INTEGER NOT NULL DEFAULT 1 CHECK (vote_number >= 1),
    ip_hash TEXT NOT NULL,
    player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_spectator_one_vote_per_event UNIQUE (audience_event_id, session_token_hash),
    CONSTRAINT fk_vote_option_event FOREIGN KEY (option_id, audience_event_id) REFERENCES public.audience_event_options(id, audience_event_id) ON DELETE CASCADE
);

-- 4. Audience Effects Applied Ledger (Supports full resolution, cancellation, override context & admin attribution)
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

-- 5. Public Game Feed Table (Sanitized Watch Stream with Minor Protection Flags)
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

-- 6. Host Broadcasts Table & Public View
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

-- 6b. Public Host Broadcasts View (Filters unpublished/internal broadcasts)
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

-- 7. Spectator Sessions Ledger (Includes Minor & Age/Safety Onboarding Parameters)
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

-- 8. Spectator System Settings Table (Global Freeze / Emergency Disable)
CREATE TABLE IF NOT EXISTS public.spectator_system_settings (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    is_spectator_system_disabled BOOLEAN NOT NULL DEFAULT false,
    disabled_reason TEXT,
    disabled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_audience_events_lookup ON public.audience_events(event_id, status);
CREATE INDEX IF NOT EXISTS idx_audience_votes_lookup ON public.audience_votes(audience_event_id, session_token_hash);
CREATE INDEX IF NOT EXISTS idx_public_feed_published ON public.public_game_feed(event_id, published_at DESC) WHERE (is_retracted = false AND is_public_feed_eligible = true AND is_minor_participant = false);

-- Enable RLS on all Phase 5 tables
ALTER TABLE public.audience_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_event_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_game_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spectator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spectator_system_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTIONS & TRIGGERS (Created BEFORE RPCs and Grants)
-- -----------------------------------------------------------------------------

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

-- 0. HARDEN PLAYERS ROLE INTEGRITY (Prerequisite for DB RLS Admin Policies)
DROP POLICY IF EXISTS "Users can update their own player profile" ON public.players;
DROP POLICY IF EXISTS "Users can insert their own player profile" ON public.players;

CREATE POLICY "Users can insert their own player profile" ON public.players
    FOR INSERT
    WITH CHECK (
        (auth.uid() = user_id OR user_id IS NULL)
        AND (role IS NULL OR role = 'player')
    );

CREATE POLICY "Users can update their own player profile" ON public.players
    FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

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

-- -----------------------------------------------------------------------------
-- RPC FUNCTIONS (Created BEFORE Revoke/Grant Privilege Statements)
-- -----------------------------------------------------------------------------

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
    -- 1. Lock and validate audience event status and timing
    SELECT * INTO v_event
    FROM public.audience_events
    WHERE id = p_audience_event_id
    FOR SHARE;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Audience event not found');
    END IF;

    -- Check if spectator system is frozen by Game Master
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

    -- 2. Verify option belongs to event (Enforced also by composite FK fk_vote_option_event)
    IF NOT EXISTS (
        SELECT 1 FROM public.audience_event_options
        WHERE id = p_option_id AND audience_event_id = p_audience_event_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid option for this audience event');
    END IF;

    -- 3. Check voter eligibility mode
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

    -- 4. Check session vote count against max_votes_per_session
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

    -- 5. Insert vote record safely
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

    -- 6. Increment vote count in options table
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

-- -----------------------------------------------------------------------------
-- SECURE RLS POLICIES & PERMISSIONS (Executed AFTER function definitions)
-- -----------------------------------------------------------------------------

-- 1. Audience Events RLS
DROP POLICY IF EXISTS "Admin access only for raw audience_events" ON public.audience_events;
CREATE POLICY "Admin access only for raw audience_events" ON public.audience_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.players
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- Grant Public read access ONLY on public_audience_events and public_audience_event_options views
GRANT SELECT ON public.public_audience_events TO anon, authenticated;
GRANT SELECT ON public.public_audience_event_options TO anon, authenticated;

-- 2. Audience Event Options RLS
DROP POLICY IF EXISTS "Admin full access to audience_event_options" ON public.audience_event_options;
CREATE POLICY "Admin full access to audience_event_options" ON public.audience_event_options
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.players
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 3. Audience Votes RLS & RPC Execution Isolation
REVOKE INSERT, UPDATE, DELETE ON public.audience_votes FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cast_spectator_vote(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_spectator_vote(UUID, UUID, TEXT, TEXT, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_or_update_spectator_session(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_or_update_spectator_session(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;

REVOKE EXECUTE ON FUNCTION public.convert_spectator_session_to_player(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_spectator_session_to_player(TEXT, UUID) TO service_role;

DROP POLICY IF EXISTS "Admin view all votes" ON public.audience_votes;
CREATE POLICY "Admin view all votes" ON public.audience_votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.players
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 4. Audience Effects RLS
DROP POLICY IF EXISTS "Admin access only for audience effects" ON public.audience_effects;
CREATE POLICY "Admin access only for audience effects" ON public.audience_effects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.players
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 5. Public Game Feed RLS
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

-- 6. Host Broadcasts RLS
GRANT SELECT ON public.public_host_broadcasts TO anon, authenticated;

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

-- 7. Spectator Sessions RLS
DROP POLICY IF EXISTS "Admin view all spectator sessions" ON public.spectator_sessions;
CREATE POLICY "Admin view all spectator sessions" ON public.spectator_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.players
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 8. Spectator System Settings RLS
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
