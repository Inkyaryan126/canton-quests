-- Canton Quests — Fair QR Hunt: 20 core QRs + 7 daily bonus QRs
-- Migration: 20260826140000_fair_qr_hunt_core_and_bonus_quests.sql
--
-- Builds the actual claimable Fair QR Hunt content on top of the
-- fair-qr-hunt event row seeded in
-- 20260826072300_operation_scoped_path_and_fair_hunt.sql. Fully additive:
--
--   - reuses the existing quests / quest_submissions / score_ledger /
--     reward_grants architecture — no parallel claim table
--   - every row is scoped to the fair-qr-hunt event_id only; nothing here
--     can be read, matched, or scored against the Sept 11 Main Operation
--   - drawing_entry_reward is explicitly 0 on every Fair quest, so a Fair
--     claim can never mint a Sept 11 prize-drawing Entry Token (the
--     column's table-wide default is 1)
--   - starting_path is explicitly NULL (the column still defaults to
--     'family' for quests — see the note on the same issue for
--     players.selected_starting_path in
--     20260826120000_remove_legacy_path_default.sql), so a Fair quest can
--     never be mistaken for a Family/Challenge/Secret district quest
--   - each row's starts_at/expires_at already keeps it inside the Fair's
--     own Sept 1–7 America/New_York window (core: the whole window; bonus:
--     its one assigned calendar day), computed here as fixed UTC instants
--     because America/New_York is a constant UTC-4 (EDT) offset for all of
--     September 2026 — no DST transition falls inside the Fair. That,
--     combined with the new getQuestAvailability() check added to both
--     submission paths in this same change (lib/quest-rewards.ts, wired
--     into lib/supabase-db.ts and lib/game-engine.ts), is what actually
--     blocks a claim before/after its window — no event-level gate needed.
--   - target_code values are the actual public scan secrets encoded into
--     each physical QR graphic; they are never exposed to players via any
--     public API (see PublicQuestView / getPublicQuestView, which already
--     strips targetCode) — only used server-side to verify a scan.
--   - ON CONFLICT (event_id, slug) DO NOTHING makes this migration safely
--     re-runnable, using the quests table's existing UNIQUE(event_id, slug)
--     constraint — no new uniqueness machinery required for the seed itself.
--
-- Also adds one small, generically useful hardening: a partial unique index
-- on quest_submissions so at most one 'verified' row can ever exist per
-- (player, quest) at the database level — belt-and-suspenders alongside the
-- pre-existing uq_score_quest_completion_xp (score_ledger) and
-- uq_reward_grants_player_quest_type_key (reward_grants) unique indexes,
-- which already make double-awarding impossible even under a race. This
-- applies to every quest in the app, not just the Fair, and cannot conflict
-- with existing data since the application layer has only ever allowed one
-- verified submission per player+quest.

CREATE UNIQUE INDEX IF NOT EXISTS uq_quest_submissions_player_quest_verified
  ON public.quest_submissions(player_id, quest_id)
  WHERE status = 'verified';

DO $$
DECLARE
  v_fair_event_id UUID;
BEGIN
  SELECT id INTO v_fair_event_id FROM public.events WHERE slug = 'fair-qr-hunt' LIMIT 1;
  IF v_fair_event_id IS NULL THEN
    RAISE EXCEPTION 'fair-qr-hunt event not found — run 20260826072300_operation_scoped_path_and_fair_hunt.sql first.';
  END IF;

  -- 20 core QRs — 100 points each, claimable any time during the Fair window.
  INSERT INTO public.quests (
    event_id, title, slug, description, instructions, point_value, xp_reward,
    drawing_entry_reward, difficulty, category, verification_type, target_code,
    proof_requirement, is_flash, starts_at, expires_at, status, sort_order,
    starting_path, gm_notes, safety_notes
  ) VALUES
    (v_fair_event_id, 'Signal 01', 'fair-core-01', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C01-E8Y6', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 1, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 02', 'fair-core-02', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C02-V8TZ', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 2, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 03', 'fair-core-03', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C03-98HH', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 3, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 04', 'fair-core-04', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C04-B625', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 4, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 05', 'fair-core-05', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C05-Q96H', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 5, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 06', 'fair-core-06', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C06-7Z96', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 6, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 07', 'fair-core-07', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C07-RT8Y', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 7, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 08', 'fair-core-08', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C08-BFVN', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 8, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 09', 'fair-core-09', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C09-7VJ4', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 9, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 10', 'fair-core-10', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C10-DH9S', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 10, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 11', 'fair-core-11', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C11-SY4H', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 11, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 12', 'fair-core-12', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C12-YY3V', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 12, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 13', 'fair-core-13', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C13-E4H8', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 13, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 14', 'fair-core-14', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C14-FC59', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 14, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 15', 'fair-core-15', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C15-YF59', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 15, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 16', 'fair-core-16', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C16-DVXZ', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 16, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 17', 'fair-core-17', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C17-4QTZ', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 17, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 18', 'fair-core-18', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C18-Y373', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 18, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 19', 'fair-core-19', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C19-UNYD', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 19, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Signal 20', 'fair-core-20', 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.', 'Find the physical QR card and scan it with your phone camera to claim this signal.', 100, 100, 0, 'easy', 'fair_core', 'qr', 'FAIR-C20-6X4J', 'Scan the physical QR marker.', false, '2026-09-01T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 20, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.')
  ON CONFLICT (event_id, slug) DO NOTHING;

  -- 7 daily bonus QRs — 300 points each, one per Fair calendar day
  -- (America/New_York). starts_at/expires_at are fixed UTC instants: each
  -- day is 00:00:00–23:59:59 America/New_York, which is UTC-4 (EDT) for
  -- all of September 2026.
  INSERT INTO public.quests (
    event_id, title, slug, description, instructions, point_value, xp_reward,
    drawing_entry_reward, difficulty, category, verification_type, target_code,
    proof_requirement, is_flash, starts_at, expires_at, status, sort_order,
    starting_path, gm_notes, safety_notes
  ) VALUES
    (v_fair_event_id, 'Daily Bonus — Sept 1', 'fair-bonus-2026-09-01', 'A one-day-only bonus QR marker, live for a single Fair calendar day.', 'Find today''s bonus QR card and scan it before the day ends — it will not be here tomorrow.', 300, 300, 0, 'medium', 'fair_bonus', 'qr', 'FAIR-B0901-FSP5', 'Scan the physical QR marker.', true, '2026-09-01T04:00:00Z', '2026-09-02T03:59:59Z', 'active', 21, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Daily Bonus — Sept 2', 'fair-bonus-2026-09-02', 'A one-day-only bonus QR marker, live for a single Fair calendar day.', 'Find today''s bonus QR card and scan it before the day ends — it will not be here tomorrow.', 300, 300, 0, 'medium', 'fair_bonus', 'qr', 'FAIR-B0902-UK33', 'Scan the physical QR marker.', true, '2026-09-02T04:00:00Z', '2026-09-03T03:59:59Z', 'active', 22, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Daily Bonus — Sept 3', 'fair-bonus-2026-09-03', 'A one-day-only bonus QR marker, live for a single Fair calendar day.', 'Find today''s bonus QR card and scan it before the day ends — it will not be here tomorrow.', 300, 300, 0, 'medium', 'fair_bonus', 'qr', 'FAIR-B0903-HERN', 'Scan the physical QR marker.', true, '2026-09-03T04:00:00Z', '2026-09-04T03:59:59Z', 'active', 23, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Daily Bonus — Sept 4', 'fair-bonus-2026-09-04', 'A one-day-only bonus QR marker, live for a single Fair calendar day.', 'Find today''s bonus QR card and scan it before the day ends — it will not be here tomorrow.', 300, 300, 0, 'medium', 'fair_bonus', 'qr', 'FAIR-B0904-PFVX', 'Scan the physical QR marker.', true, '2026-09-04T04:00:00Z', '2026-09-05T03:59:59Z', 'active', 24, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Daily Bonus — Sept 5', 'fair-bonus-2026-09-05', 'A one-day-only bonus QR marker, live for a single Fair calendar day.', 'Find today''s bonus QR card and scan it before the day ends — it will not be here tomorrow.', 300, 300, 0, 'medium', 'fair_bonus', 'qr', 'FAIR-B0905-V47W', 'Scan the physical QR marker.', true, '2026-09-05T04:00:00Z', '2026-09-06T03:59:59Z', 'active', 25, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Daily Bonus — Sept 6', 'fair-bonus-2026-09-06', 'A one-day-only bonus QR marker, live for a single Fair calendar day.', 'Find today''s bonus QR card and scan it before the day ends — it will not be here tomorrow.', 300, 300, 0, 'medium', 'fair_bonus', 'qr', 'FAIR-B0906-UG5W', 'Scan the physical QR marker.', true, '2026-09-06T04:00:00Z', '2026-09-07T03:59:59Z', 'active', 26, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.'),
    (v_fair_event_id, 'Daily Bonus — Sept 7', 'fair-bonus-2026-09-07', 'A one-day-only bonus QR marker, live for a single Fair calendar day.', 'Find today''s bonus QR card and scan it before the day ends — it will not be here tomorrow.', 300, 300, 0, 'medium', 'fair_bonus', 'qr', 'FAIR-B0907-87AA', 'Scan the physical QR marker.', true, '2026-09-07T04:00:00Z', '2026-09-08T03:59:59Z', 'active', 27, NULL, 'Placement TBD.', 'Stay in public fairground areas and use marked walkways.')
  ON CONFLICT (event_id, slug) DO NOTHING;
END $$;
