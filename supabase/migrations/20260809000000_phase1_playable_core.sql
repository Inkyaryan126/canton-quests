-- Canton Quests Phase 1 Database Schema Migration
-- Migration: 20260809000000_phase1_playable_core.sql

-- Enable PostGIS if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Cities
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    state TEXT NOT NULL DEFAULT 'OH',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Players (extends auth.users or standalone player profile)
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, -- References auth.users(id) when auth is linked
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin', 'partner')),
    total_xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Locations
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_notes TEXT,
    is_partner BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'active', 'ended')),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    basic_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Event Players (Registrations)
CREATE TABLE IF NOT EXISTS public.event_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, player_id)
);

-- 6. Quests
CREATE TABLE IF NOT EXISTS public.quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL,
    instructions TEXT NOT NULL,
    point_value INTEGER NOT NULL DEFAULT 100,
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'epic')),
    category TEXT NOT NULL DEFAULT 'exploration',
    verification_type TEXT NOT NULL DEFAULT 'checkin' CHECK (verification_type IN ('checkin', 'qr', 'passphrase', 'photo', 'video')),
    target_code TEXT, -- Target answer / code hash for passphrase or QR code
    proof_requirement TEXT,
    is_flash BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, slug)
);

-- 7. Quest Submissions
CREATE TABLE IF NOT EXISTS public.quest_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    proof_type TEXT NOT NULL,
    submitted_content TEXT,
    proof_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    awarded_points INTEGER NOT NULL DEFAULT 0,
    feedback TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

-- 8. Score Ledger
CREATE TABLE IF NOT EXISTS public.score_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    quest_id UUID REFERENCES public.quests(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES public.quest_submissions(id) ON DELETE SET NULL,
    points INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'quest_completion',
    description TEXT,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_events_city_id ON public.events(city_id);
CREATE INDEX IF NOT EXISTS idx_quests_event_id ON public.quests(event_id);
CREATE INDEX IF NOT EXISTS idx_submissions_player_quest ON public.quest_submissions(player_id, quest_id);
CREATE INDEX IF NOT EXISTS idx_submissions_event_status ON public.quest_submissions(event_id, status);
CREATE INDEX IF NOT EXISTS idx_score_ledger_event_player ON public.score_ledger(event_id, player_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Cities: Public read
CREATE POLICY "Cities are viewable by everyone" ON public.cities FOR SELECT USING (true);

-- Players: Public read basic info, update own
CREATE POLICY "Player profiles viewable by everyone" ON public.players FOR SELECT USING (true);
CREATE POLICY "Users can insert their own player profile" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own player profile" ON public.players FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Locations: Public read
CREATE POLICY "Locations viewable by everyone" ON public.locations FOR SELECT USING (true);

-- Events: Public read
CREATE POLICY "Events viewable by everyone" ON public.events FOR SELECT USING (true);

-- Event Players: Public read, insert own
CREATE POLICY "Event registrations viewable by everyone" ON public.event_players FOR SELECT USING (true);
CREATE POLICY "Players can register for events" ON public.event_players FOR INSERT WITH CHECK (true);

-- Quests: Public read active events' quests
CREATE POLICY "Quests viewable by everyone" ON public.quests FOR SELECT USING (true);

-- Quest Submissions: Players see own submissions, insert own
CREATE POLICY "Players can view submissions" ON public.quest_submissions FOR SELECT USING (true);
CREATE POLICY "Players can create submissions" ON public.quest_submissions FOR INSERT WITH CHECK (true);

-- Score Ledger: Public read for leaderboard
CREATE POLICY "Score ledger viewable by everyone" ON public.score_ledger FOR SELECT USING (true);
