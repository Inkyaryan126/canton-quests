-- Canton Quests Core Quest Rewards Backbone Migration
-- Migration: 20260812000000_core_quest_rewards_backbone.sql

-- 1. Extend Quests Table with XP Reward, Drawing Entry Reward and Internal GM Notes
ALTER TABLE public.quests
  ADD COLUMN IF NOT EXISTS xp_reward INTEGER,
  ADD COLUMN IF NOT EXISTS drawing_entry_reward INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS gm_notes TEXT,
  ADD COLUMN IF NOT EXISTS safety_notes TEXT;

-- Update Check Constraints on Quests and Submissions for new verification and status enums
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_verification_type_check;
ALTER TABLE public.quests ADD CONSTRAINT quests_verification_type_check
  CHECK (verification_type IN ('checkin', 'qr', 'passphrase', 'photo', 'video', 'gps', 'game_master', 'multi_step'));

ALTER TABLE public.quest_submissions DROP CONSTRAINT IF EXISTS quest_submissions_status_check;
ALTER TABLE public.quest_submissions ADD CONSTRAINT quest_submissions_status_check
  CHECK (status IN ('not_started', 'in_progress', 'pending', 'verified', 'rejected', 'retry_requested'));

-- 2. Extend Quest Submissions Table with Drawing Entries Count & Multi-Step Progress
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

-- 3. Quest Steps Table (Multi-Step Quests)
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

-- 4. Drawing Entry Ledger Table (Event-Scoped Immutable Drawing Entry Ledger)
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

-- 5. Drawing Ledger Locks Table
CREATE TABLE IF NOT EXISTS public.drawing_ledger_locks (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMPTZ,
    lock_reason TEXT,
    locked_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_drawing_ledger_event_player ON public.drawing_entry_ledger(event_id, player_id);
CREATE INDEX IF NOT EXISTS idx_drawing_ledger_quest ON public.drawing_entry_ledger(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_steps_quest ON public.quest_steps(quest_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_score_quest_completion_xp
  ON public.score_ledger(event_id, player_id, quest_id)
  WHERE quest_id IS NOT NULL AND points > 0 AND category = 'quest_completion';

-- Enable RLS
ALTER TABLE public.quest_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawing_entry_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawing_ledger_locks ENABLE ROW LEVEL SECURITY;

-- 6. Public Sanitized Projections & RLS Policies
DROP POLICY IF EXISTS "Quests viewable by everyone" ON public.quests;
DROP POLICY IF EXISTS "Players can view submissions" ON public.quest_submissions;
DROP POLICY IF EXISTS "Players can create submissions" ON public.quest_submissions;
DROP POLICY IF EXISTS "Score ledger viewable by everyone" ON public.score_ledger;

CREATE POLICY "Admins can view raw quests" ON public.quests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

CREATE POLICY "Players can view own submissions" ON public.quest_submissions
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM public.players WHERE id = player_id)
    OR EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

CREATE POLICY "Admins can view score ledger" ON public.score_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

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

-- Quest steps view excluding target_code for public queries
CREATE OR REPLACE VIEW public.public_quest_steps AS
SELECT id, quest_id, step_order, title, instructions, verification_type, location_id, radius_meters, created_at
FROM public.quest_steps;

ALTER VIEW public.public_quest_steps SET (security_barrier = true);

DROP POLICY IF EXISTS "Players view own drawing entries" ON public.drawing_entry_ledger;
DROP POLICY IF EXISTS "Drawing entries viewable by everyone" ON public.drawing_entry_ledger;
CREATE POLICY "Admins can view raw drawing entries" ON public.drawing_entry_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid() AND players.role = 'admin'
    )
  );

-- Public Drawing Ledger Projection View: Exposes sanitized public player labels, totals, and lock status
CREATE OR REPLACE VIEW public.public_drawing_ledger_projection
WITH (security_barrier = true) AS
SELECT
  del.event_id,
  p.display_name AS player_public_label,
  SUM(del.entries_count)::INT AS total_qualified_entries,
  COALESCE(dll.is_locked, false) AS is_locked,
  dll.locked_at
FROM public.drawing_entry_ledger del
JOIN public.players p ON del.player_id = p.id
LEFT JOIN public.drawing_ledger_locks dll ON del.event_id = dll.event_id
GROUP BY del.event_id, p.display_name, dll.is_locked, dll.locked_at;

DROP POLICY IF EXISTS "Drawing ledger locks viewable by everyone" ON public.drawing_ledger_locks;
CREATE POLICY "Drawing ledger locks viewable by everyone" ON public.drawing_ledger_locks FOR SELECT USING (true);

GRANT SELECT ON public.public_quests TO anon, authenticated;
GRANT SELECT ON public.public_quest_steps TO anon, authenticated;
GRANT SELECT ON public.public_drawing_ledger_projection TO anon, authenticated;
