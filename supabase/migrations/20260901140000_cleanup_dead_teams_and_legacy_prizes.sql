-- Canton Quests — Confirmed Dead Schema Cleanup Migration
-- Migration: 20260901140000_cleanup_dead_teams_and_legacy_prizes.sql
--
-- Scope strictly limited to confirmed-dead legacy objects:
-- 1. public.prizes (abandoned Phase 3 predecessor, 100% superseded by public.event_prizes)
-- 2. public.team_members (legacy squad join table, abolished in ADR-023)
-- 3. public.teams (legacy squad group table, abolished in ADR-023)
-- 4. Obsolete team_id columns:
--    - public.quest_submissions.team_id
--    - public.score_ledger.team_id
--    - public.code_redemptions.team_id
--    - public.finale_qualifications.team_id
--
-- SAFETY & INTEGRITY GUARANTEES:
-- - Explicit precondition assertion DO block: fails loudly if any data is unexpectedly present.
-- - No cascading drops: known dependencies are explicitly removed in dependency-safe order.
-- - Does NOT touch public.event_prizes or public.prize_draw_records.
-- - Does NOT touch public.public_quests (the live public quest view).
-- - Does NOT touch optional or planned tables (bonus_windows, crowd_objectives, generated_qrs,
--   live_events, field_npcs, player_links, player_personal_roles, watcher_eligibility, etc.).

-- ============================================================================
-- STEP 1: PRECONDITION ASSERTIONS
-- ============================================================================

DO $$
DECLARE
    v_teams_count INTEGER := 0;
    v_team_members_count INTEGER := 0;
    v_prizes_count INTEGER := 0;
    v_qs_team_id_count INTEGER := 0;
    v_sl_team_id_count INTEGER := 0;
    v_cr_team_id_count INTEGER := 0;
    v_fq_team_id_count INTEGER := 0;
BEGIN
    -- Check table row counts if tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') THEN
        SELECT count(*) INTO v_teams_count FROM public.teams;
        IF v_teams_count > 0 THEN
            RAISE EXCEPTION 'Cleanup aborted: public.teams is not empty (found % rows)', v_teams_count;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_members') THEN
        SELECT count(*) INTO v_team_members_count FROM public.team_members;
        IF v_team_members_count > 0 THEN
            RAISE EXCEPTION 'Cleanup aborted: public.team_members is not empty (found % rows)', v_team_members_count;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prizes') THEN
        SELECT count(*) INTO v_prizes_count FROM public.prizes;
        IF v_prizes_count > 0 THEN
            RAISE EXCEPTION 'Cleanup aborted: public.prizes is not empty (found % rows)', v_prizes_count;
        END IF;
    END IF;

    -- Check non-null team_id column counts if columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quest_submissions' AND column_name = 'team_id') THEN
        SELECT count(*) INTO v_qs_team_id_count FROM public.quest_submissions WHERE team_id IS NOT NULL;
        IF v_qs_team_id_count > 0 THEN
            RAISE EXCEPTION 'Cleanup aborted: public.quest_submissions has % non-null team_id values', v_qs_team_id_count;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'score_ledger' AND column_name = 'team_id') THEN
        SELECT count(*) INTO v_sl_team_id_count FROM public.score_ledger WHERE team_id IS NOT NULL;
        IF v_sl_team_id_count > 0 THEN
            RAISE EXCEPTION 'Cleanup aborted: public.score_ledger has % non-null team_id values', v_sl_team_id_count;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'code_redemptions' AND column_name = 'team_id') THEN
        SELECT count(*) INTO v_cr_team_id_count FROM public.code_redemptions WHERE team_id IS NOT NULL;
        IF v_cr_team_id_count > 0 THEN
            RAISE EXCEPTION 'Cleanup aborted: public.code_redemptions has % non-null team_id values', v_cr_team_id_count;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'finale_qualifications' AND column_name = 'team_id') THEN
        SELECT count(*) INTO v_fq_team_id_count FROM public.finale_qualifications WHERE team_id IS NOT NULL;
        IF v_fq_team_id_count > 0 THEN
            RAISE EXCEPTION 'Cleanup aborted: public.finale_qualifications has % non-null team_id values', v_fq_team_id_count;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: DROP TEAM FOREIGN-KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE public.quest_submissions DROP CONSTRAINT IF EXISTS quest_submissions_team_id_fkey;
ALTER TABLE public.score_ledger DROP CONSTRAINT IF EXISTS score_ledger_team_id_fkey;
ALTER TABLE public.code_redemptions DROP CONSTRAINT IF EXISTS code_redemptions_team_id_fkey;
ALTER TABLE public.finale_qualifications DROP CONSTRAINT IF EXISTS finale_qualifications_team_id_fkey;

-- ============================================================================
-- STEP 3: DROP OBSOLETE TEAM_ID COLUMNS
-- ============================================================================

ALTER TABLE public.quest_submissions DROP COLUMN IF EXISTS team_id;
ALTER TABLE public.score_ledger DROP COLUMN IF EXISTS team_id;
ALTER TABLE public.code_redemptions DROP COLUMN IF EXISTS team_id;
ALTER TABLE public.finale_qualifications DROP COLUMN IF EXISTS team_id;

-- ============================================================================
-- STEP 4: DROP TEAM_MEMBERS TABLE
-- ============================================================================

DROP TABLE IF EXISTS public.team_members;

-- ============================================================================
-- STEP 5: DROP TEAMS TABLE
-- ============================================================================

DROP TABLE IF EXISTS public.teams;

-- ============================================================================
-- STEP 6: DROP ABANDONED PRIZES PREDECESSOR TABLE
-- ============================================================================

DROP TABLE IF EXISTS public.prizes;
