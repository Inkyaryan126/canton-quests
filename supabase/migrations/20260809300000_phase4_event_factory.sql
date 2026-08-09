-- Canton Quests Phase 4 Database Schema Migration
-- Migration: 20260809300000_phase4_event_factory.sql

-- 1. Extend Events table for Event Factory
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS safety_notes TEXT,
  ADD COLUMN IF NOT EXISTS map_center_lat DOUBLE PRECISION DEFAULT 40.7989,
  ADD COLUMN IF NOT EXISTS map_center_lon DOUBLE PRECISION DEFAULT -81.3748,
  ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS readiness_status TEXT DEFAULT 'draft';

-- 2. Extend Quest Submissions for Proof Integrity & Flags
ALTER TABLE public.quest_submissions
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT,
  ADD COLUMN IF NOT EXISTS review_flags JSONB,
  ADD COLUMN IF NOT EXISTS retry_requested BOOLEAN DEFAULT false;

-- 3. Extend NPC Characters for Private Operator Notes
ALTER TABLE public.npc_characters
  ADD COLUMN IF NOT EXISTS operator_notes TEXT;

-- 4. Generated QR Codes Table
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

-- 5. Quest Templates Table
CREATE TABLE IF NOT EXISTS public.quest_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    preset JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_generated_qrs_event ON public.generated_qrs(event_id);
CREATE INDEX IF NOT EXISTS idx_generated_qrs_token ON public.generated_qrs(token);

-- Enable RLS on Phase 4 tables
ALTER TABLE public.generated_qrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Generated QRs viewable by everyone" ON public.generated_qrs FOR SELECT USING (true);
CREATE POLICY "Quest templates viewable by everyone" ON public.quest_templates FOR SELECT USING (true);

-- 6. Storage Bucket for Quest Media Proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('quest-proofs', 'quest-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Quest proofs public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quest-proofs');

CREATE POLICY "Quest proofs authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'quest-proofs');
