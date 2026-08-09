-- Canton Quests Phase 2 Database Schema Migration
-- Migration: 20260809100000_phase2_realworld_game_layer.sql

-- 1. Extend Locations with Phase 2 fields
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS access_notes TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours TEXT;

-- 2. Extend Quests with Phase 2 fields & unlock rules
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS prerequisite_quest_id UUID REFERENCES public.quests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unlock_condition_type TEXT DEFAULT 'none' CHECK (unlock_condition_type IN ('none', 'prerequisite', 'scheduled', 'manual')),
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS require_location_verification BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_qr_and_location BOOLEAN DEFAULT false;

-- 3. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    captain_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    avatar_symbol TEXT DEFAULT '🛡️',
    total_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Team Members Table
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(team_id, player_id)
);

-- 5. Extend Quest Submissions with Team & Geolocation
ALTER TABLE public.quest_submissions
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS user_lon DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_from_location INTEGER;

-- 6. Extend Score Ledger with Team
ALTER TABLE public.score_ledger
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_teams_event ON public.teams(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON public.teams(join_code);
CREATE INDEX IF NOT EXISTS idx_team_members_player ON public.team_members(player_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_quests_prereq ON public.quests(prerequisite_quest_id);

-- Enable RLS on Teams and Team Members
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Teams viewable by everyone" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Players can create teams" ON public.teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Captains can update teams" ON public.teams FOR UPDATE USING (true);

CREATE POLICY "Team members viewable by everyone" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Players can join teams" ON public.team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can leave teams" ON public.team_members FOR DELETE USING (true);
