-- ARCHIVED — non-executable historical record only.
-- This file is NOT consumed by `supabase db push` / `supabase db reset`
-- (supabase/migrations-archive/ is outside the CLI's migrations path).
--
-- Recovered verbatim from production's applied migration history
-- (supabase_migrations.schema_migrations), preserved here so the exact
-- historical record survives even after its schema_migrations tracking
-- row is reconciled (applied-under-a-different-version or reverted).
--
-- Original recorded version: 20260825011604
-- Original recorded name:    increment_drawing_entries_rpc

CREATE OR REPLACE FUNCTION public.increment_drawing_entries(
  p_event_id UUID,
  p_player_id UUID,
  p_quest_id UUID,
  p_add_entries INTEGER,
  p_submission_id UUID,
  p_source_type TEXT,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  INSERT INTO public.drawing_entry_ledger (event_id, player_id, quest_id, submission_id, entries_count, source_type, reason)
  VALUES (p_event_id, p_player_id, p_quest_id, p_submission_id, p_add_entries, p_source_type, p_reason)
  ON CONFLICT (event_id, player_id, quest_id) DO UPDATE SET
    entries_count = public.drawing_entry_ledger.entries_count + p_add_entries,
    submission_id = EXCLUDED.submission_id,
    reason = EXCLUDED.reason
  RETURNING entries_count INTO v_total;

  RETURN v_total;
END;
$$;
