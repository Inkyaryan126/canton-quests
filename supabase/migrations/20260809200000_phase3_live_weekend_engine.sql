-- Canton Quests Phase 3 Database Schema Migration
-- Migration: 20260809200000_phase3_live_weekend_engine.sql

-- 1. Extend Events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS current_phase TEXT DEFAULT 'day_1',
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- 2. Extend Quests table
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS claim_limit INTEGER,
  ADD COLUMN IF NOT EXISTS current_claims INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_secret BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_finale_quest BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS race_rewards JSONB,
  ADD COLUMN IF NOT EXISTS hints JSONB,
  ADD COLUMN IF NOT EXISTS risk_reward JSONB,
  ADD COLUMN IF NOT EXISTS required_collectible_id UUID;

-- 3. Extend Quest Submissions
ALTER TABLE public.quest_submissions
  ADD COLUMN IF NOT EXISTS claim_placement INTEGER;

-- 4. Extend Score Ledger
ALTER TABLE public.score_ledger
  ADD COLUMN IF NOT EXISTS admin_identity TEXT;

-- 5. Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'info' CHECK (urgency IN ('info', 'warning', 'flash', 'urgent')),
    expires_at TIMESTAMPTZ,
    linked_quest_id UUID REFERENCES public.quests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Collectibles Table
CREATE TABLE IF NOT EXISTS public.collectibles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    badge_symbol TEXT NOT NULL DEFAULT '🏅',
    rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'legendary')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Player Collectibles Table
CREATE TABLE IF NOT EXISTS public.player_collectibles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    collectible_id UUID NOT NULL REFERENCES public.collectibles(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'quest',
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(player_id, collectible_id)
);

-- 8. Secret Codes Table
CREATE TABLE IF NOT EXISTS public.secret_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    bonus_points INTEGER NOT NULL DEFAULT 100,
    max_redemptions INTEGER,
    current_redemptions INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    grant_collectible_id UUID REFERENCES public.collectibles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, code)
);

-- 9. Code Redemptions Table
CREATE TABLE IF NOT EXISTS public.code_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_id UUID NOT NULL REFERENCES public.secret_codes(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(code_id, player_id)
);

-- 10. NPC Characters Table
CREATE TABLE IF NOT EXISTS public.npc_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    alias_name TEXT NOT NULL,
    description TEXT NOT NULL,
    avatar_symbol TEXT NOT NULL DEFAULT '🕵️',
    is_active BOOLEAN NOT NULL DEFAULT true,
    current_zone TEXT NOT NULL,
    clue_hint TEXT NOT NULL,
    secret_code TEXT,
    last_spotted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Business Partners Table
CREATE TABLE IF NOT EXISTS public.business_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_notes TEXT,
    public_instructions TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Crowd Objectives Table
CREATE TABLE IF NOT EXISTS public.crowd_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_count INTEGER NOT NULL,
    current_count INTEGER NOT NULL DEFAULT 0,
    objective_type TEXT NOT NULL CHECK (objective_type IN ('total_completions', 'collectibles_found', 'teams_active')),
    is_achieved BOOLEAN NOT NULL DEFAULT false,
    unlocked_quest_id UUID REFERENCES public.quests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Bonus Windows Table
CREATE TABLE IF NOT EXISTS public.bonus_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    flat_bonus INTEGER NOT NULL DEFAULT 0,
    target_category TEXT,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Finale Qualifications Table
CREATE TABLE IF NOT EXISTS public.finale_qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    qualification_reason TEXT NOT NULL,
    is_wildcard BOOLEAN NOT NULL DEFAULT false,
    qualified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, player_id)
);

-- 15. Prizes Table
CREATE TABLE IF NOT EXISTS public.prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sponsor_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    eligibility_rule TEXT NOT NULL,
    winner_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    awarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_event ON public.announcements(event_id);
CREATE INDEX IF NOT EXISTS idx_secret_codes_event ON public.secret_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_player_collectibles_player ON public.player_collectibles(player_id);
CREATE INDEX IF NOT EXISTS idx_finale_qualifications_event ON public.finale_qualifications(event_id);
CREATE INDEX IF NOT EXISTS idx_bonus_windows_event ON public.bonus_windows(event_id);

-- Enable RLS on all Phase 3 tables
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collectibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_collectibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crowd_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finale_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;

-- Public Read RLS Policies
CREATE POLICY "Announcements viewable by everyone" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Collectibles viewable by everyone" ON public.collectibles FOR SELECT USING (true);
CREATE POLICY "Player collectibles viewable by everyone" ON public.player_collectibles FOR SELECT USING (true);
CREATE POLICY "NPC characters viewable by everyone" ON public.npc_characters FOR SELECT USING (true);
CREATE POLICY "Business partners viewable by everyone" ON public.business_partners FOR SELECT USING (true);
CREATE POLICY "Crowd objectives viewable by everyone" ON public.crowd_objectives FOR SELECT USING (true);
CREATE POLICY "Bonus windows viewable by everyone" ON public.bonus_windows FOR SELECT USING (true);
CREATE POLICY "Finale qualifications viewable by everyone" ON public.finale_qualifications FOR SELECT USING (true);
CREATE POLICY "Prizes viewable by everyone" ON public.prizes FOR SELECT USING (true);
