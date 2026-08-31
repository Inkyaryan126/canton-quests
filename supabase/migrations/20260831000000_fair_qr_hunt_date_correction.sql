-- Canton Quests — Fair QR Hunt date correction
-- =================================================================
-- The Fair QR Hunt's real-world dates changed from a 7-day window
-- (Sept 1-7) to a 2-day window: Friday Sept 4 - Saturday Sept 5, 2026.
-- Non-destructive and additive only — no row is deleted:
--   1. The event's own start/end window moves to the real 2-day window.
--   2. The 20 permanent core Signals' availability window moves with it
--      (they were always "active for the whole Fair", so they just track
--      the new, shorter window).
--   3. The 5 daily-bonus Signals that fall outside the new window
--      (Sept 1, 2, 3, 6, 7) are marked status = 'inactive' — the same
--      convention already used elsewhere in this schema for cut/retired
--      quests (see e.g. qst-founders-secret-clue, qst-civic-seal-photo)
--      — rather than deleted, so the historical rows and any already-
--      claimed submissions against them are preserved untouched.
--   4. The 2 daily-bonus Signals that fall inside the new window
--      (fair-bonus-2026-09-04, fair-bonus-2026-09-05) already have the
--      correct dates/windows from the original seed migration
--      (20260826140000_fair_qr_hunt_core_and_bonus_quests.sql) and are
--      intentionally left untouched here.

DO $$
DECLARE
  v_fair_event_id UUID;
BEGIN
  SELECT id INTO v_fair_event_id FROM public.events WHERE slug = 'fair-qr-hunt';

  IF v_fair_event_id IS NULL THEN
    RETURN;
  END IF;

  -- 1. Event window: Sept 4, 12:00 AM ET -> Sept 5, 11:59:59 PM ET.
  UPDATE public.events
  SET start_time = '2026-09-04T04:00:00Z',
      end_time = '2026-09-06T03:59:59Z'
  WHERE id = v_fair_event_id;

  -- 2. The 20 core Signals track the new, shorter Fair window.
  UPDATE public.quests
  SET starts_at = '2026-09-04T04:00:00Z',
      expires_at = '2026-09-06T03:59:59Z'
  WHERE event_id = v_fair_event_id
    AND category = 'fair_core';

  -- 3. Daily-bonus Signals outside the new 2-day window are deactivated,
  --    not deleted.
  UPDATE public.quests
  SET status = 'inactive'
  WHERE event_id = v_fair_event_id
    AND category = 'fair_bonus'
    AND slug IN (
      'fair-bonus-2026-09-01',
      'fair-bonus-2026-09-02',
      'fair-bonus-2026-09-03',
      'fair-bonus-2026-09-06',
      'fair-bonus-2026-09-07'
    );
END $$;
