-- Canton Quests — Founder's Cipher Master Launch Pivot: Production
-- Winner-Audit Persistence
--
-- Photo/video proof is never a real-time moderation queue (see the
-- verification-method reconciliation migration and lib/supabase-db.ts's
-- verifyAutomatedProof): it auto-completes immediately, and the evidence
-- is simply locked, immutable evidence from that point on. The only later
-- manual-review step is a prize-payout safeguard — when executePrizeDrawDB
-- selects a winning_player_id, that specific player's own photo/video
-- evidence for this event is flagged for a Game Master to look at before
-- payout. This column is what makes that state real and queryable in
-- production, not just in the local/offline engine.
--
-- Small, additive, backward-compatible change: nullable text column, no
-- existing rows affected (their audit_status is simply NULL, equivalent to
-- 'not_needed' for every submission that predates this column).

ALTER TABLE public.quest_submissions
  ADD COLUMN IF NOT EXISTS audit_status TEXT
  CHECK (audit_status IS NULL OR audit_status IN ('not_needed', 'winner_audit_pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_quest_submissions_audit_status
  ON public.quest_submissions (event_id, audit_status)
  WHERE audit_status = 'winner_audit_pending';
