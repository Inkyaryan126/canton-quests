-- =============================================================================
-- Canton Quests Migration: Player Identity + Three-Path City Architecture
-- Version: 20260814000000
-- Description: Adds Player Profile fields, 3-Path district attribution,
--              Achievements System, and Day 1 #1 XP Leader Bonus support.
-- =============================================================================

-- 1. Extend Players table with profile & path attribution fields
ALTER TABLE players ADD COLUMN IF NOT EXISTS selected_starting_path TEXT DEFAULT 'family';
ALTER TABLE players ADD COLUMN IF NOT EXISTS acquisition_source TEXT DEFAULT 'main_site';
ALTER TABLE players ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS hometown TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#f59e0b';
ALTER TABLE players ADD COLUMN IF NOT EXISTS favorite_style TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS selected_flair TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS showcase_badges TEXT[] DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Extend Quests table with starting_path column
ALTER TABLE quests ADD COLUMN IF NOT EXISTS starting_path TEXT DEFAULT 'family';

-- 3. Create Achievements Catalog Table
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  badge_symbol TEXT NOT NULL,
  category TEXT NOT NULL, -- 'path' | 'district' | 'exploration' | 'speed' | 'social' | 'competitive' | 'mastery'
  rarity TEXT NOT NULL,   -- 'common' | 'rare' | 'epic' | 'legendary'
  district TEXT,          -- 'family' | 'challenge' | 'secret'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Player Achievements Junction Table
CREATE TABLE IF NOT EXISTS player_achievements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  achievement_slug TEXT NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  provenance TEXT,
  CONSTRAINT unique_player_achievement UNIQUE (player_id, achievement_slug)
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_slug ON player_achievements(achievement_slug);
CREATE INDEX IF NOT EXISTS idx_quests_starting_path ON quests(starting_path);
CREATE INDEX IF NOT EXISTS idx_players_starting_path ON players(selected_starting_path);

-- 5. Seed Canonical Achievements
INSERT INTO achievements (id, slug, name, description, badge_symbol, category, rarity, district)
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

-- 6. Row Level Security (RLS) Policies
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;

-- Public read access for achievements catalog
CREATE POLICY "Achievements catalog is publicly readable"
  ON achievements FOR SELECT
  USING (true);

-- Public read access for player achievements (leaderboard / showcase)
CREATE POLICY "Player achievements are publicly readable"
  ON player_achievements FOR SELECT
  USING (true);

-- Service role full access
CREATE POLICY "Service role manages player achievements"
  ON player_achievements FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
