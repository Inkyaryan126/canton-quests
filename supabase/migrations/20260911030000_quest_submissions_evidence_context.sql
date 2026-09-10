-- Canton Quests — Founder's Cipher Master Launch Pivot: Evidence Context
-- Snapshot
--
-- A photo/video quest submission must preserve exactly what the player was
-- shown and what they uploaded at the moment their evidence was confirmed —
-- quest title, instructions, proof requirement, evidence path, MIME type,
-- and capture timestamp — never regenerated later from whatever the quest's
-- text happens to read at winner-audit or finale time. See
-- lib/quest-evidence.ts's buildEvidenceContextSnapshot and
-- lib/supabase-db.ts's submitQuestProofDB.
--
-- Small, additive, backward-compatible change: nullable JSONB column, no
-- existing rows affected (their evidence_context is simply NULL — they
-- predate this snapshot).

ALTER TABLE public.quest_submissions
  ADD COLUMN IF NOT EXISTS evidence_context JSONB;
