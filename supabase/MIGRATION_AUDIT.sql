-- =============================================================================
-- CANTON QUESTS — COMPREHENSIVE FORENSIC MIGRATION AUDIT QUERY
-- =============================================================================
-- Target Database: Supabase / PostgreSQL
-- Purpose: Forensically audit the database state against all 12 migration files
--          in supabase/migrations/ by inspecting actual database objects
--          (tables, columns, indexes, views, functions, triggers, constraints,
--          RLS enabled status, RLS policies, and canonical seed records).
-- Safety: READ-ONLY. Zero writes, zero DDL, zero modifications, zero locks.
-- Output: 1 readable row per migration with status: PASS | PARTIAL | MISSING.
-- =============================================================================

WITH
-- -----------------------------------------------------------------------------
-- Cached System Catalog Snapshots
-- -----------------------------------------------------------------------------
cat_tables AS (
  SELECT n.nspname AS schemaname, c.relname AS tablename, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
),
cat_columns AS (
  SELECT table_schema AS schemaname, table_name AS tablename, column_name
  FROM information_schema.columns
),
cat_indexes AS (
  SELECT schemaname, tablename, indexname
  FROM pg_indexes
),
cat_views AS (
  SELECT schemaname, viewname
  FROM pg_views
),
cat_procs AS (
  SELECT n.nspname AS schemaname, p.proname AS procname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
),
cat_triggers AS (
  SELECT n.nspname AS schemaname, c.relname AS tablename, t.tgname AS triggername
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE NOT t.tgisinternal
),
cat_constraints AS (
  SELECT n.nspname AS schemaname, c.relname AS tablename, con.conname AS constraintname
  FROM pg_constraint con
  JOIN pg_class c ON con.conrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
),
cat_policies AS (
  SELECT schemaname, tablename, policyname
  FROM pg_policies
),

-- -----------------------------------------------------------------------------
-- Forensic Itemized Checks per Migration
-- -----------------------------------------------------------------------------
migration_checks AS (

  -- ===========================================================================
  -- 1. 20260809000000_phase1_playable_core.sql
  -- ===========================================================================
  SELECT 1 AS migration_seq, '20260809000000_phase1_playable_core.sql' AS migration_name, 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies' AS migration_notes, 'table:public.cities' AS check_name,
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'cities') AS passed
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'table:public.players',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'players')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'table:public.locations',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'locations')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'table:public.events',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'events')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'table:public.event_players',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'event_players')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'table:public.quests',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quests')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'table:public.quest_submissions',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quest_submissions')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'table:public.score_ledger',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'score_ledger')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'column:cities.slug',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'cities' AND column_name = 'slug')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'column:players.role',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'role')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'column:locations.city_id',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'locations' AND column_name = 'city_id')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'column:events.slug',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'events' AND column_name = 'slug')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'column:quests.point_value',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'point_value')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'column:quest_submissions.proof_type',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'proof_type')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'column:score_ledger.points',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'score_ledger' AND column_name = 'points')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'index:idx_events_city_id',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'events' AND indexname = 'idx_events_city_id')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'index:idx_quests_event_id',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'quests' AND indexname = 'idx_quests_event_id')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'index:idx_submissions_player_quest',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND indexname = 'idx_submissions_player_quest')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'index:idx_submissions_event_status',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND indexname = 'idx_submissions_event_status')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'index:idx_score_ledger_event_player',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'score_ledger' AND indexname = 'idx_score_ledger_event_player')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'rls:cities',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'cities' AND rls_enabled = true)
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'rls:players',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'players' AND rls_enabled = true)
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'rls:locations',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'locations' AND rls_enabled = true)
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'rls:events',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'events' AND rls_enabled = true)
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'rls:event_players',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'event_players' AND rls_enabled = true)
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'rls:quests',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quests' AND rls_enabled = true)
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'rls:quest_submissions',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND rls_enabled = true)
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'rls:score_ledger',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'score_ledger' AND rls_enabled = true)
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'policy:cities.Cities are viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'cities' AND policyname = 'Cities are viewable by everyone')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'policy:locations.Locations viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'locations' AND policyname = 'Locations viewable by everyone')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'policy:events.Events viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Events viewable by everyone')
  UNION ALL
  SELECT 1, '20260809000000_phase1_playable_core.sql', 'Phase 1 core playable schema: 8 tables, core relations, indexes, RLS enabled, baseline policies', 'policy:event_players.Event registrations viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'event_players' AND policyname = 'Event registrations viewable by everyone')

  -- ===========================================================================
  -- 2. 20260809100000_phase2_realworld_game_layer.sql
  -- ===========================================================================
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'table:public.teams',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'teams')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'table:public.team_members',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'team_members')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:locations.radius_meters',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'locations' AND column_name = 'radius_meters')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:locations.access_notes',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'locations' AND column_name = 'access_notes')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:locations.opening_hours',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'locations' AND column_name = 'opening_hours')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quests.radius_meters',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'radius_meters')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quests.prerequisite_quest_id',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'prerequisite_quest_id')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quests.unlock_condition_type',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'unlock_condition_type')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quests.starts_at',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'starts_at')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quests.require_location_verification',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'require_location_verification')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quests.require_qr_and_location',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'require_qr_and_location')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quest_submissions.team_id',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'team_id')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quest_submissions.user_lat',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'user_lat')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quest_submissions.user_lon',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'user_lon')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:quest_submissions.distance_from_location',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'distance_from_location')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'column:score_ledger.team_id',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'score_ledger' AND column_name = 'team_id')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'index:idx_teams_event',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'teams' AND indexname = 'idx_teams_event')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'index:idx_teams_join_code',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'teams' AND indexname = 'idx_teams_join_code')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'index:idx_team_members_player',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'team_members' AND indexname = 'idx_team_members_player')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'index:idx_team_members_team',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'team_members' AND indexname = 'idx_team_members_team')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'index:idx_quests_prereq',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'quests' AND indexname = 'idx_quests_prereq')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'rls:teams',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'teams' AND rls_enabled = true)
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'rls:team_members',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'team_members' AND rls_enabled = true)
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'policy:teams.Teams viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'teams' AND policyname = 'Teams viewable by everyone')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'policy:teams.Players can create teams',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'teams' AND policyname = 'Players can create teams')
  UNION ALL
  SELECT 2, '20260809100000_phase2_realworld_game_layer.sql', 'Phase 2 real-world game layer: teams, team_members, quest prerequisite chains, geolocation fields on submissions', 'policy:team_members.Team members viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'Team members viewable by everyone')

  -- ===========================================================================
  -- 3. 20260809200000_phase3_live_weekend_engine.sql
  -- ===========================================================================
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.announcements',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'announcements')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.collectibles',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'collectibles')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.player_collectibles',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'player_collectibles')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.secret_codes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'secret_codes')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.code_redemptions',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'code_redemptions')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.npc_characters',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'npc_characters')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.business_partners',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'business_partners')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.crowd_objectives',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'crowd_objectives')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.bonus_windows',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'bonus_windows')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.finale_qualifications',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'finale_qualifications')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'table:public.prizes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'prizes')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:events.current_phase',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'events' AND column_name = 'current_phase')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:events.is_paused',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'events' AND column_name = 'is_paused')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:quests.claim_limit',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'claim_limit')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:quests.is_secret',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'is_secret')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:quests.is_finale_quest',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'is_finale_quest')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:quests.race_rewards',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'race_rewards')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:quests.hints',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'hints')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:quests.risk_reward',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'risk_reward')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:quests.required_collectible_id',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'required_collectible_id')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:quest_submissions.claim_placement',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'claim_placement')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'column:score_ledger.admin_identity',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'score_ledger' AND column_name = 'admin_identity')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'index:idx_announcements_event',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'announcements' AND indexname = 'idx_announcements_event')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'index:idx_secret_codes_event',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'secret_codes' AND indexname = 'idx_secret_codes_event')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'index:idx_player_collectibles_player',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'player_collectibles' AND indexname = 'idx_player_collectibles_player')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'index:idx_finale_qualifications_event',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'finale_qualifications' AND indexname = 'idx_finale_qualifications_event')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'index:idx_bonus_windows_event',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'bonus_windows' AND indexname = 'idx_bonus_windows_event')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:announcements',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'announcements' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:collectibles',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'collectibles' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:player_collectibles',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'player_collectibles' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:secret_codes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'secret_codes' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:npc_characters',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'npc_characters' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:business_partners',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'business_partners' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:crowd_objectives',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'crowd_objectives' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:bonus_windows',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'bonus_windows' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:finale_qualifications',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'finale_qualifications' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'rls:prizes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'prizes' AND rls_enabled = true)
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'policy:announcements.Announcements viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'announcements' AND policyname = 'Announcements viewable by everyone')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'policy:collectibles.Collectibles viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'collectibles' AND policyname = 'Collectibles viewable by everyone')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'policy:npc_characters.NPC characters viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'npc_characters' AND policyname = 'NPC characters viewable by everyone')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'policy:business_partners.Business partners viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'business_partners' AND policyname = 'Business partners viewable by everyone')
  UNION ALL
  SELECT 3, '20260809200000_phase3_live_weekend_engine.sql', 'Phase 3 live weekend engine: 11 tables (collectibles, codes, NPCs, partners, bonus windows, finale), live event controls', 'policy:prizes.Prizes viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'prizes' AND policyname = 'Prizes viewable by everyone')

  -- ===========================================================================
  -- 4. 20260809300000_phase4_event_factory.sql
  -- ===========================================================================
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'table:public.generated_qrs',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'generated_qrs')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'table:public.quest_templates',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quest_templates')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:events.registration_start_time',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'events' AND column_name = 'registration_start_time')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:events.safety_notes',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'events' AND column_name = 'safety_notes')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:events.map_center_lat',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'events' AND column_name = 'map_center_lat')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:events.map_center_lon',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'events' AND column_name = 'map_center_lon')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:events.theme_color',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'events' AND column_name = 'theme_color')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:events.readiness_status',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'events' AND column_name = 'readiness_status')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:quest_submissions.reviewer_notes',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'reviewer_notes')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:quest_submissions.review_flags',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'review_flags')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:quest_submissions.retry_requested',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'retry_requested')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'column:npc_characters.operator_notes',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'npc_characters' AND column_name = 'operator_notes')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'index:idx_generated_qrs_event',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'generated_qrs' AND indexname = 'idx_generated_qrs_event')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'index:idx_generated_qrs_token',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'generated_qrs' AND indexname = 'idx_generated_qrs_token')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'rls:generated_qrs',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'generated_qrs' AND rls_enabled = true)
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'rls:quest_templates',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quest_templates' AND rls_enabled = true)
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'policy:generated_qrs.Generated QRs viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'generated_qrs' AND policyname = 'Generated QRs viewable by everyone')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'policy:quest_templates.Quest templates viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'quest_templates' AND policyname = 'Quest templates viewable by everyone')
  UNION ALL
  SELECT 4, '20260809300000_phase4_event_factory.sql', 'Phase 4 event factory: generated_qrs, quest_templates, event readiness config, review flags, quest-proofs bucket', 'storage_bucket:quest-proofs',
    (to_regclass('storage.buckets') IS NOT NULL AND (query_to_xml('SELECT 1 FROM storage.buckets WHERE id = ''quest-proofs''', true, false, '')::text LIKE '%<row>%'))

  -- ===========================================================================
  -- 5. 20260809400000_phase5_spectator_engine.sql
  -- ===========================================================================
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'table:public.audience_events',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'audience_events')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'table:public.audience_event_options',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'audience_event_options')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'table:public.audience_votes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'audience_votes')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'table:public.audience_effects',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'audience_effects')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'table:public.public_game_feed',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'public_game_feed')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'table:public.host_broadcasts',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'host_broadcasts')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'table:public.spectator_sessions',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'spectator_sessions')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'table:public.spectator_system_settings',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'spectator_system_settings')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'view:public.public_audience_events',
    EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_audience_events')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'view:public.public_audience_event_options',
    EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_audience_event_options')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'view:public.public_host_broadcasts',
    EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_host_broadcasts')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'index:uq_single_active_audience_event',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'audience_events' AND indexname = 'uq_single_active_audience_event')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'index:idx_audience_events_lookup',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'audience_events' AND indexname = 'idx_audience_events_lookup')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'index:idx_audience_votes_lookup',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'audience_votes' AND indexname = 'idx_audience_votes_lookup')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'index:idx_public_feed_published',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'public_game_feed' AND indexname = 'idx_public_feed_published')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'function:public.check_spectator_vote_limit',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'check_spectator_vote_limit')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'function:public.prevent_player_role_self_elevation',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'prevent_player_role_self_elevation')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'function:public.cast_spectator_vote',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'cast_spectator_vote')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'function:public.register_or_update_spectator_session',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'register_or_update_spectator_session')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'function:public.convert_spectator_session_to_player',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'convert_spectator_session_to_player')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'trigger:trg_enforce_spectator_vote_limit',
    EXISTS (SELECT 1 FROM cat_triggers WHERE schemaname = 'public' AND tablename = 'audience_votes' AND triggername = 'trg_enforce_spectator_vote_limit')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'trigger:trg_protect_player_role',
    EXISTS (SELECT 1 FROM cat_triggers WHERE schemaname = 'public' AND tablename = 'players' AND triggername = 'trg_protect_player_role')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'rls:audience_events',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'audience_events' AND rls_enabled = true)
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'rls:audience_event_options',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'audience_event_options' AND rls_enabled = true)
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'rls:audience_votes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'audience_votes' AND rls_enabled = true)
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'rls:audience_effects',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'audience_effects' AND rls_enabled = true)
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'rls:public_game_feed',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'public_game_feed' AND rls_enabled = true)
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'rls:host_broadcasts',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'host_broadcasts' AND rls_enabled = true)
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'rls:spectator_sessions',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'spectator_sessions' AND rls_enabled = true)
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'rls:spectator_system_settings',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'spectator_system_settings' AND rls_enabled = true)
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'policy:audience_events.Admin access only for raw audience_events',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'audience_events' AND policyname = 'Admin access only for raw audience_events')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'policy:public_game_feed.Public read non-retracted published feed',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'public_game_feed' AND policyname = 'Public read non-retracted published feed')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'policy:host_broadcasts.Public read published host broadcasts',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'host_broadcasts' AND policyname = 'Public read published host broadcasts')
  UNION ALL
  SELECT 5, '20260809400000_phase5_spectator_engine.sql', 'Phase 5 spectator engine: audience events/votes/effects, public feed, broadcasts, vote/role triggers, RPCs, views', 'policy:spectator_system_settings.Public read spectator system settings',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'spectator_system_settings' AND policyname = 'Public read spectator system settings')

  -- ===========================================================================
  -- 6. 20260812000000_core_quest_rewards_backbone.sql
  -- ===========================================================================
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'table:public.quest_steps',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quest_steps')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'table:public.drawing_entry_ledger',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'table:public.drawing_ledger_locks',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'column:quests.xp_reward',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'xp_reward')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'column:quests.drawing_entry_reward',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'drawing_entry_reward')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'column:quests.gm_notes',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'gm_notes')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'column:quests.safety_notes',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'safety_notes')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'column:quest_submissions.drawing_entries_awarded',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'drawing_entries_awarded')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'column:quest_submissions.completed_step_order',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND column_name = 'completed_step_order')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'constraint:quests.quests_id_event_id_unique',
    EXISTS (SELECT 1 FROM cat_constraints WHERE schemaname = 'public' AND tablename = 'quests' AND constraintname = 'quests_id_event_id_unique')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'constraint:quest_submissions.quest_submissions_quest_event_fk',
    EXISTS (SELECT 1 FROM cat_constraints WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND constraintname = 'quest_submissions_quest_event_fk')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'constraint:drawing_entry_ledger.uq_player_event_quest_drawing',
    EXISTS (SELECT 1 FROM cat_constraints WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger' AND constraintname = 'uq_player_event_quest_drawing')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'constraint:drawing_entry_ledger.drawing_entries_positive_check',
    EXISTS (SELECT 1 FROM cat_constraints WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger' AND constraintname = 'drawing_entries_positive_check')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'index:idx_drawing_ledger_event_player',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger' AND indexname = 'idx_drawing_ledger_event_player')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'index:idx_drawing_ledger_quest',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger' AND indexname = 'idx_drawing_ledger_quest')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'index:idx_quest_steps_quest',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'quest_steps' AND indexname = 'idx_quest_steps_quest')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'index:uq_score_quest_completion_xp',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'score_ledger' AND indexname = 'uq_score_quest_completion_xp')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'view:public.public_quests',
    EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_quests')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'view:public.public_quest_steps',
    EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_quest_steps')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'view:public.public_drawing_ledger_projection',
    EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_drawing_ledger_projection')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'rls:quest_steps',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quest_steps' AND rls_enabled = true)
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'rls:drawing_entry_ledger',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger' AND rls_enabled = true)
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'rls:drawing_ledger_locks',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND rls_enabled = true)
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'policy:quests.Admins can view raw quests',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'quests' AND policyname = 'Admins can view raw quests')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'policy:quest_submissions.Players can view own submissions',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND policyname = 'Players can view own submissions')
  UNION ALL
  SELECT 6, '20260812000000_core_quest_rewards_backbone.sql', 'Core quest rewards: xp/drawing rewards, multi-step quest_steps, drawing_entry_ledger, sanitized projections', 'policy:drawing_entry_ledger.Admins can view raw drawing entries',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger' AND policyname = 'Admins can view raw drawing entries')

  -- ===========================================================================
  -- 7. 20260813000000_transparent_prize_drawing_system.sql
  -- ===========================================================================
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'table:public.event_prizes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'event_prizes')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'table:public.prize_draw_records',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'prize_draw_records')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'column:drawing_ledger_locks.status',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND column_name = 'status')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'column:drawing_ledger_locks.snapshot_hash',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND column_name = 'snapshot_hash')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'column:drawing_ledger_locks.canonical_snapshot',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND column_name = 'canonical_snapshot')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'column:drawing_ledger_locks.total_qualified_entries',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND column_name = 'total_qualified_entries')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'column:drawing_ledger_locks.total_qualified_players',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND column_name = 'total_qualified_players')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'constraint:drawing_ledger_locks.drawing_ledger_locks_status_check',
    EXISTS (SELECT 1 FROM cat_constraints WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND constraintname = 'drawing_ledger_locks_status_check')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'constraint:prize_draw_records.prize_draw_records_status_check',
    EXISTS (SELECT 1 FROM cat_constraints WHERE schemaname = 'public' AND tablename = 'prize_draw_records' AND constraintname = 'prize_draw_records_status_check')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'index:idx_prize_draw_records_event',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'prize_draw_records' AND indexname = 'idx_prize_draw_records_event')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'index:idx_event_prizes_event',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'event_prizes' AND indexname = 'idx_event_prizes_event')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'index:uq_active_prize_draw_per_event_prize',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'prize_draw_records' AND indexname = 'uq_active_prize_draw_per_event_prize')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'function:public.fn_prevent_locked_drawing_ledger_edits',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'fn_prevent_locked_drawing_ledger_edits')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'function:public.fn_prevent_locked_drawing_ledger_locks_edits',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'fn_prevent_locked_drawing_ledger_locks_edits')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'function:public.execute_prize_draw_if_drawable',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'execute_prize_draw_if_drawable')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'function:public.publish_prize_draws_if_publishable',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'publish_prize_draws_if_publishable')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'trigger:trg_prevent_locked_drawing_ledger_edits',
    EXISTS (SELECT 1 FROM cat_triggers WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger' AND triggername = 'trg_prevent_locked_drawing_ledger_edits')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'trigger:trg_prevent_locked_drawing_ledger_locks_edits',
    EXISTS (SELECT 1 FROM cat_triggers WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND triggername = 'trg_prevent_locked_drawing_ledger_locks_edits')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'view:public.public_published_drawings_projection',
    EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_published_drawings_projection')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'rls:event_prizes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'event_prizes' AND rls_enabled = true)
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'rls:prize_draw_records',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'prize_draw_records' AND rls_enabled = true)
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'policy:event_prizes.Prizes viewable by everyone',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'event_prizes' AND policyname = 'Prizes viewable by everyone')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'policy:prize_draw_records.Admins can view prize draw records',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'prize_draw_records' AND policyname = 'Admins can view prize draw records')
  UNION ALL
  SELECT 7, '20260813000000_transparent_prize_drawing_system.sql', 'Transparent prize drawings: event_prizes, prize_draw_records, ledger lock immutability triggers, draw/publish RPCs', 'policy:drawing_ledger_locks.Admins can view drawing ledger locks',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND policyname = 'Admins can view drawing ledger locks')

  -- ===========================================================================
  -- 8. 20260813010000_qr_campaign_attribution.sql
  -- ===========================================================================
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'table:public.qr_campaigns',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'qr_campaigns')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'table:public.campaign_flyer_variants',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'campaign_flyer_variants')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'table:public.campaign_distributors',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'campaign_distributors')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'table:public.campaign_qr_codes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'campaign_qr_codes')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'table:public.campaign_visits',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'campaign_visits')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'index:idx_campaign_flyers_campaign',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'campaign_flyer_variants' AND indexname = 'idx_campaign_flyers_campaign')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'index:idx_campaign_distributors_campaign',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'campaign_distributors' AND indexname = 'idx_campaign_distributors_campaign')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'index:idx_campaign_qrs_campaign',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'campaign_qr_codes' AND indexname = 'idx_campaign_qrs_campaign')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'index:idx_campaign_qrs_slug_active',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'campaign_qr_codes' AND indexname = 'idx_campaign_qrs_slug_active')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'index:idx_campaign_visits_campaign_created',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'campaign_visits' AND indexname = 'idx_campaign_visits_campaign_created')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'rls:qr_campaigns',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'qr_campaigns' AND rls_enabled = true)
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'rls:campaign_flyer_variants',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'campaign_flyer_variants' AND rls_enabled = true)
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'rls:campaign_distributors',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'campaign_distributors' AND rls_enabled = true)
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'rls:campaign_qr_codes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'campaign_qr_codes' AND rls_enabled = true)
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'rls:campaign_visits',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'campaign_visits' AND rls_enabled = true)
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'policy:qr_campaigns.GM admin manages qr campaigns',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'qr_campaigns' AND policyname = 'GM admin manages qr campaigns')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'policy:campaign_qr_codes.GM admin manages campaign qr codes',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'campaign_qr_codes' AND policyname = 'GM admin manages campaign qr codes')
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'seed:campaign_street_team_2026',
    (to_regclass('public.qr_campaigns') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.qr_campaigns WHERE slug = ''canton-quests-street-team-2026'' OR id = ''camp-street-team-2026''', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'seed:campaign_flyer_variants_3',
    (to_regclass('public.campaign_flyer_variants') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.campaign_flyer_variants v JOIN public.qr_campaigns c ON v.campaign_id = c.id WHERE (c.slug = ''canton-quests-street-team-2026'' OR c.id = ''camp-street-team-2026'') AND v.name IN (''Family'', ''Challenge'', ''Secret'') HAVING count(DISTINCT v.name) = 3', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'seed:campaign_distributors_3',
    (to_regclass('public.campaign_distributors') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.campaign_distributors d JOIN public.qr_campaigns c ON d.campaign_id = c.id WHERE (c.slug = ''canton-quests-street-team-2026'' OR c.id = ''camp-street-team-2026'') AND d.name IN (''Dustin'', ''Employee 1'', ''Employee 2'') HAVING count(DISTINCT d.name) = 3', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 8, '20260813010000_qr_campaign_attribution.sql', 'QR campaign attribution: 5 campaign tracking tables, GM admin policies, canonical 2026 Street Team seed data', 'seed:campaign_qr_codes_9',
    (to_regclass('public.campaign_qr_codes') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.campaign_qr_codes q JOIN public.qr_campaigns c ON q.campaign_id = c.id WHERE (c.slug = ''canton-quests-street-team-2026'' OR c.id = ''camp-street-team-2026'') AND q.tracking_slug IN (''f1'', ''f2'', ''f3'', ''c1'', ''c2'', ''c3'', ''s1'', ''s2'', ''s3'') HAVING count(DISTINCT q.tracking_slug) = 9', true, false, '')::text LIKE '%<row>%'))

  -- ===========================================================================
  -- 9. 20260814000000_player_identity_three_path_architecture.sql
  -- ===========================================================================
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'table:public.achievements',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'achievements')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'table:public.player_achievements',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'player_achievements')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:players.selected_starting_path',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'selected_starting_path')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:players.bio',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'bio')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:players.tagline',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'tagline')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:players.hometown',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'hometown')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:players.favorite_style',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'favorite_style')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:players.selected_flair',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'selected_flair')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:players.showcase_badges',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'showcase_badges')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:players.is_minor',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'is_minor')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:players.email',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'players' AND column_name = 'email')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'column:quests.starting_path',
    EXISTS (SELECT 1 FROM cat_columns WHERE schemaname = 'public' AND tablename = 'quests' AND column_name = 'starting_path')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'constraint:player_achievements.unique_player_achievement',
    EXISTS (SELECT 1 FROM cat_constraints WHERE schemaname = 'public' AND tablename = 'player_achievements' AND constraintname = 'unique_player_achievement')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'index:idx_player_achievements_player',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'player_achievements' AND indexname = 'idx_player_achievements_player')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'index:idx_player_achievements_slug',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'player_achievements' AND indexname = 'idx_player_achievements_slug')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'index:idx_quests_starting_path',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'quests' AND indexname = 'idx_quests_starting_path')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'index:idx_players_starting_path',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'players' AND indexname = 'idx_players_starting_path')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'rls:achievements',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'achievements' AND rls_enabled = true)
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'rls:player_achievements',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'player_achievements' AND rls_enabled = true)
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'policy:achievements.Achievements catalog is publicly readable',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'achievements' AND policyname = 'Achievements catalog is publicly readable')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'policy:player_achievements.Player achievements are publicly readable',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'player_achievements' AND policyname = 'Player achievements are publicly readable')
  UNION ALL
  SELECT 9, '20260814000000_player_identity_three_path_architecture.sql', 'Player identity & 3-path architecture: player profile fields, starting_path, achievements catalog, 9 canonical seeds', 'seed:canonical_achievements_9',
    (to_regclass('public.achievements') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.achievements WHERE slug IN (''pathfinder-family'', ''pathfinder-challenge'', ''pathfinder-secret'', ''district-sweep-family'', ''district-sweep-challenge'', ''district-sweep-secret'', ''triple-threat'', ''nomad'', ''day-one-king'') HAVING count(DISTINCT slug) = 9', true, false, '')::text LIKE '%<row>%'))

  -- ===========================================================================
  -- 10. 20260814010000_critical_player_auth_remediation.sql
  -- ===========================================================================
  UNION ALL
  SELECT 10, '20260814010000_critical_player_auth_remediation.sql', 'Player auth remediation: unique user_id index, lower email index, anti-tampering trigger, hardened RLS', 'index:idx_players_user_id_unique',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'players' AND indexname = 'idx_players_user_id_unique')
  UNION ALL
  SELECT 10, '20260814010000_critical_player_auth_remediation.sql', 'Player auth remediation: unique user_id index, lower email index, anti-tampering trigger, hardened RLS', 'index:idx_players_email_lower',
    EXISTS (SELECT 1 FROM cat_indexes WHERE schemaname = 'public' AND tablename = 'players' AND indexname = 'idx_players_email_lower')
  UNION ALL
  SELECT 10, '20260814010000_critical_player_auth_remediation.sql', 'Player auth remediation: unique user_id index, lower email index, anti-tampering trigger, hardened RLS', 'function:public.prevent_player_user_id_tampering',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'prevent_player_user_id_tampering')
  UNION ALL
  SELECT 10, '20260814010000_critical_player_auth_remediation.sql', 'Player auth remediation: unique user_id index, lower email index, anti-tampering trigger, hardened RLS', 'trigger:trg_prevent_player_user_id_tampering',
    EXISTS (SELECT 1 FROM cat_triggers WHERE schemaname = 'public' AND tablename = 'players' AND triggername = 'trg_prevent_player_user_id_tampering')
  UNION ALL
  SELECT 10, '20260814010000_critical_player_auth_remediation.sql', 'Player auth remediation: unique user_id index, lower email index, anti-tampering trigger, hardened RLS', 'policy:players.Users can insert their own player profile',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'players' AND policyname = 'Users can insert their own player profile')
  UNION ALL
  SELECT 10, '20260814010000_critical_player_auth_remediation.sql', 'Player auth remediation: unique user_id index, lower email index, anti-tampering trigger, hardened RLS', 'policy:players.Users can update their own player profile',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'players' AND policyname = 'Users can update their own player profile')
  UNION ALL
  SELECT 10, '20260814010000_critical_player_auth_remediation.sql', 'Player auth remediation: unique user_id index, lower email index, anti-tampering trigger, hardened RLS', 'policy:quest_submissions.Players can create submissions',
    EXISTS (SELECT 1 FROM cat_policies WHERE schemaname = 'public' AND tablename = 'quest_submissions' AND policyname = 'Players can create submissions')

  -- ===========================================================================
  -- 11. 20260814020000_restore_canton_volume1_production_seed.sql
  -- ===========================================================================
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:city_canton',
    (to_regclass('public.cities') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.cities WHERE slug = ''canton-oh'' OR id = ''a0000001-0000-4000-8000-000000000001''::uuid', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:locations_9_canonical',
    (to_regclass('public.locations') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.locations WHERE id IN (''c0000001-0000-4000-8000-000000000001''::uuid, ''c0000001-0000-4000-8000-000000000002''::uuid, ''c0000001-0000-4000-8000-000000000003''::uuid, ''c0000001-0000-4000-8000-000000000004''::uuid, ''c0000001-0000-4000-8000-000000000005''::uuid, ''c0000001-0000-4000-8000-000000000006''::uuid, ''c0000001-0000-4000-8000-000000000007''::uuid, ''c0000001-0000-4000-8000-000000000008''::uuid, ''c0000001-0000-4000-8000-000000000009''::uuid) HAVING count(DISTINCT id) = 9', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:event_volume1_founders_cipher',
    (to_regclass('public.events') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.events WHERE id = ''b0000001-0000-4000-8000-000000000001''::uuid OR slug = ''canton-weekend-1''', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:collectibles_5_canonical',
    (to_regclass('public.collectibles') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.collectibles WHERE id IN (''d0000001-0000-4000-8000-000000000001''::uuid, ''d0000001-0000-4000-8000-000000000002''::uuid, ''d0000001-0000-4000-8000-000000000003''::uuid, ''d0000001-0000-4000-8000-000000000004''::uuid, ''d0000001-0000-4000-8000-000000000005''::uuid) HAVING count(DISTINCT id) = 5', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:quests_15_canonical',
    (to_regclass('public.quests') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.quests WHERE id BETWEEN ''e0000001-0000-4000-8000-000000000001''::uuid AND ''e0000001-0000-4000-8000-000000000015''::uuid HAVING count(DISTINCT id) = 15', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:quest_steps_3_canonical',
    (to_regclass('public.quest_steps') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.quest_steps WHERE quest_id = ''e0000001-0000-4000-8000-000000000011''::uuid HAVING count(*) = 3', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:secret_codes_2_canonical',
    (to_regclass('public.secret_codes') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.secret_codes WHERE id IN (''50000001-0000-4000-8000-000000000001''::uuid, ''50000001-0000-4000-8000-000000000002''::uuid) HAVING count(DISTINCT id) = 2', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:npc_courier',
    (to_regclass('public.npc_characters') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.npc_characters WHERE id = ''60000001-0000-4000-8000-000000000001''::uuid', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:business_partners_2',
    (to_regclass('public.business_partners') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.business_partners WHERE id IN (''70000001-0000-4000-8000-000000000001''::uuid, ''70000001-0000-4000-8000-000000000002''::uuid) HAVING count(DISTINCT id) = 2', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:event_prizes_2',
    (to_regclass('public.event_prizes') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.event_prizes WHERE id IN (''80000001-0000-4000-8000-000000000001''::uuid, ''80000001-0000-4000-8000-000000000002''::uuid) HAVING count(DISTINCT id) = 2', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 11, '20260814020000_restore_canton_volume1_production_seed.sql', 'Canonical Volume 1 seed data: Canton city, 9 locations, Volume 1 event, 15 quests, 3 steps, 5 collectibles, 2 codes, NPC, 2 partners, 2 prizes', 'seed:drawing_ledger_lock_volume1',
    (to_regclass('public.drawing_ledger_locks') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.drawing_ledger_locks WHERE event_id = ''b0000001-0000-4000-8000-000000000001''::uuid', true, false, '')::text LIKE '%<row>%'))

  -- ===========================================================================
  -- 12. 20260814030000_production_schema_catchup_and_volume1_restore.sql
  -- ===========================================================================
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec1:generated_qrs_table',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'generated_qrs')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec1:quest_templates_table',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quest_templates')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec2:spectator_engine_audience_events',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'audience_events')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec2:spectator_engine_public_feed',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'public_game_feed')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec2:spectator_engine_broadcasts',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'host_broadcasts')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec2:spectator_engine_cast_vote_rpc',
    EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'cast_spectator_vote')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec2:spectator_engine_views',
    (EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_audience_events') AND EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_host_broadcasts'))
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec3:core_rewards_quest_steps',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'quest_steps')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec3:core_rewards_drawing_ledger',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec3:core_rewards_public_views',
    (EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_quests') AND EXISTS (SELECT 1 FROM cat_views WHERE schemaname = 'public' AND viewname = 'public_quest_steps'))
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec4:transparent_drawings_prize_records',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'prize_draw_records')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec4:transparent_drawings_event_prizes',
    EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'event_prizes')
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec4:transparent_drawings_immutability_triggers',
    (EXISTS (SELECT 1 FROM cat_triggers WHERE schemaname = 'public' AND tablename = 'drawing_entry_ledger' AND triggername = 'trg_prevent_locked_drawing_ledger_edits') AND EXISTS (SELECT 1 FROM cat_triggers WHERE schemaname = 'public' AND tablename = 'drawing_ledger_locks' AND triggername = 'trg_prevent_locked_drawing_ledger_locks_edits'))
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec4:transparent_drawings_rpcs',
    (EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'execute_prize_draw_if_drawable') AND EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'publish_prize_draws_if_publishable'))
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec5:qr_campaign_tables',
    (EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'qr_campaigns') AND EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'campaign_qr_codes'))
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec5:qr_campaign_street_team_seed',
    (to_regclass('public.qr_campaigns') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.qr_campaigns WHERE slug = ''canton-quests-street-team-2026'' OR id = ''camp-street-team-2026''', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec6:player_achievements_tables',
    (EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'achievements') AND EXISTS (SELECT 1 FROM cat_tables WHERE schemaname = 'public' AND tablename = 'player_achievements'))
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec6:achievements_9_seed',
    (to_regclass('public.achievements') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.achievements WHERE slug IN (''pathfinder-family'', ''pathfinder-challenge'', ''pathfinder-secret'', ''district-sweep-family'', ''district-sweep-challenge'', ''district-sweep-secret'', ''triple-threat'', ''nomad'', ''day-one-king'') HAVING count(DISTINCT slug) = 9', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec7:player_auth_anti_tampering',
    (EXISTS (SELECT 1 FROM cat_procs WHERE schemaname = 'public' AND procname = 'prevent_player_user_id_tampering') AND EXISTS (SELECT 1 FROM cat_triggers WHERE schemaname = 'public' AND tablename = 'players' AND triggername = 'trg_prevent_player_user_id_tampering'))
  UNION ALL
  SELECT 12, '20260814030000_production_schema_catchup_and_volume1_restore.sql', 'Production catch-up & Volume 1 restore: full modern consolidated state across Phase 4, Phase 5.1, Rewards, Drawings, QR, 3-Path, Auth, Volume 1', 'catchup_sec8:volume1_canonical_data_restored',
    ((to_regclass('public.quests') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.quests WHERE id BETWEEN ''e0000001-0000-4000-8000-000000000001''::uuid AND ''e0000001-0000-4000-8000-000000000015''::uuid HAVING count(DISTINCT id) = 15', true, false, '')::text LIKE '%<row>%')) AND (to_regclass('public.locations') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.locations WHERE id BETWEEN ''c0000001-0000-4000-8000-000000000001''::uuid AND ''c0000001-0000-4000-8000-000000000009''::uuid HAVING count(DISTINCT id) = 9', true, false, '')::text LIKE '%<row>%')))
  -- ===========================================================================
  -- 13. 20260814040000_repair_qr_street_team_canonical_seed.sql
  -- ===========================================================================
  UNION ALL
  SELECT 13, '20260814040000_repair_qr_street_team_canonical_seed.sql', 'QR street team canonical seed repair: restores campaign, 3 variants, 3 distributors, 9 QR tracking assignments', 'seed_repair:campaign_street_team_2026',
    (to_regclass('public.qr_campaigns') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.qr_campaigns WHERE id = ''camp-street-team-2026'' OR slug = ''canton-quests-street-team-2026''', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 13, '20260814040000_repair_qr_street_team_canonical_seed.sql', 'QR street team canonical seed repair: restores campaign, 3 variants, 3 distributors, 9 QR tracking assignments', 'seed_repair:campaign_flyer_variants_3',
    (to_regclass('public.campaign_flyer_variants') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.campaign_flyer_variants v JOIN public.qr_campaigns c ON v.campaign_id = c.id WHERE (c.slug = ''canton-quests-street-team-2026'' OR c.id = ''camp-street-team-2026'') AND v.name IN (''Family'', ''Challenge'', ''Secret'') HAVING count(DISTINCT v.name) = 3', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 13, '20260814040000_repair_qr_street_team_canonical_seed.sql', 'QR street team canonical seed repair: restores campaign, 3 variants, 3 distributors, 9 QR tracking assignments', 'seed_repair:campaign_distributors_3',
    (to_regclass('public.campaign_distributors') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.campaign_distributors d JOIN public.qr_campaigns c ON d.campaign_id = c.id WHERE (c.slug = ''canton-quests-street-team-2026'' OR c.id = ''camp-street-team-2026'') AND d.name IN (''Dustin'', ''Employee 1'', ''Employee 2'') HAVING count(DISTINCT d.name) = 3', true, false, '')::text LIKE '%<row>%'))
  UNION ALL
  SELECT 13, '20260814040000_repair_qr_street_team_canonical_seed.sql', 'QR street team canonical seed repair: restores campaign, 3 variants, 3 distributors, 9 QR tracking assignments', 'seed_repair:campaign_qr_codes_9',
    (to_regclass('public.campaign_qr_codes') IS NOT NULL AND (query_to_xml('SELECT 1 FROM public.campaign_qr_codes q JOIN public.qr_campaigns c ON q.campaign_id = c.id WHERE (c.slug = ''canton-quests-street-team-2026'' OR c.id = ''camp-street-team-2026'') AND q.tracking_slug IN (''f1'', ''f2'', ''f3'', ''c1'', ''c2'', ''c3'', ''s1'', ''s2'', ''s3'') HAVING count(DISTINCT q.tracking_slug) = 9', true, false, '')::text LIKE '%<row>%'))
)

-- -----------------------------------------------------------------------------
-- Final Aggregation & Audit Report
-- -----------------------------------------------------------------------------
SELECT
  migration_name AS migration,
  CASE
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE passed) THEN 'PASS'
    WHEN COUNT(*) FILTER (WHERE passed) > 0 THEN 'PARTIAL'
    ELSE 'MISSING'
  END AS status,
  COUNT(*) FILTER (WHERE passed)::INTEGER AS checks_passed,
  COUNT(*)::INTEGER AS checks_expected,
  COALESCE(
    string_agg(check_name, ', ' ORDER BY check_name) FILTER (WHERE NOT passed),
    'None'
  ) AS missing_objects,
  migration_notes AS notes
FROM migration_checks
GROUP BY migration_seq, migration_name, migration_notes
ORDER BY migration_seq ASC;
