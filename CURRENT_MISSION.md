# CURRENT MISSION: PHASE 5.1 — SPECTATOR DATABASE SCHEMA, ADMIN SECURITY PREREQUISITE & CORE ENGINE API

## GOAL
Implement the foundational admin security prerequisites, database migration, TypeScript types, core game engine functions, and API endpoints for the Canton Quests Spectator & Audience Participation Engine.

## SCOPE OF WORK
1. **Admin Security Prerequisite (`app/admin/live/page.tsx`, `lib/admin-auth.ts`, `app/api/admin/session/route.ts`)**:
   - Implement server-only GM authorization boundary on `/admin/live` and `/admin` routes.
   - Do NOT import `verifyAdminSecret` or secret verification logic into client components or browser JavaScript bundles.
   - Do NOT rely on hardcoded default production secrets (e.g. `'canton-gm-2026'`); mandate server-side evaluation of `process.env.ADMIN_SECRET_KEY`.
   - Issue HTTP-only SameSite admin session cookies or perform server-side session checks via `/api/admin/session` or Server Actions.
   - Enforce server-side administrative authorization checks via `authorizeGameMasterRequest(headers)` or Supabase `role = 'admin'` for all privileged GM API routes and actions.

2. **Database Migration (`supabase/migrations/20260809400000_phase5_spectator_engine.sql`)**:
   - **Harden `public.players` Role Integrity**: Ensure `public.players` UPDATE policy preserves `user_id`-based profile ownership (`USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL)`) and attach PostgreSQL trigger `trg_protect_player_role` (raising an exception on any non-service_role attempt to mutate `NEW.role IS DISTINCT FROM OLD.role`) to block client self-elevation to `role = 'admin'` before trusting `players.role = 'admin'` in any database RLS policies.
   - Implement tables: `audience_events`, `audience_event_options`, `audience_votes`, `audience_effects`, `public_game_feed`, `host_broadcasts`, `spectator_sessions`, `spectator_system_settings`.
   - Add `CONSTRAINT uq_option_id_event_id UNIQUE (id, audience_event_id)` to `audience_event_options` and `CONSTRAINT fk_vote_option_event FOREIGN KEY (option_id, audience_event_id) REFERENCES public.audience_event_options(id, audience_event_id)` to `audience_votes` for same-event structural enforcement.
   - Create double-sanitized public security barrier views using `WITH (security_barrier = true)`:
     - `public_audience_events`: Mask internal admin IDs (`created_by`, `resolved_by`), target secrets (`target_id`, `target_name`), and manual override notes (`is_manually_overridden`, `override_reason`), exposing only public title, description, status, timestamps, vote rules, and coarse target descriptions (`WHERE status IN ('voting_active', 'tallying_closed', 'effect_applied', 'resolved')`).
     - `public_audience_event_options`: Mask `effect_payload` AND filter to active/resolved events (`WHERE e.status IN ('voting_active', 'tallying_closed', 'effect_applied', 'resolved')`).
   - Direct RLS on raw `audience_events` table restricted strictly to GM Admins (`role = 'admin'`).
   - Support minor protections and age/safety onboarding: `is_minor`, `age_acknowledged_at`, `safety_acknowledged_at` in `spectator_sessions`; `is_minor_participant`, `is_public_feed_eligible` in `public_game_feed`.
   - **Enforce Database Read Boundary Privacy & Eligibility**: The `public_game_feed` SELECT RLS policy MUST require `is_public_feed_eligible = true AND is_minor_participant = false` alongside `published_at <= NOW() AND is_retracted = false` to suppress ineligible and minor participant rows at the database read boundary.
   - Include GM control columns in `audience_events`: `is_paused`, `paused_at`, `eligibility_mode`, `max_votes_per_session`, `target_type`, `target_id`, `target_name`, `is_manually_overridden`, `override_reason`, `resolved_by`.
   - Define `CREATE OR REPLACE FUNCTION ...` for `check_spectator_vote_limit`, `cast_spectator_vote`, `register_or_update_spectator_session`, and `convert_spectator_session_to_player` BEFORE executing privilege REVOKE/GRANT statements.
   - Explicitly lock search path on all `SECURITY DEFINER` functions using `SET search_path = public, pg_temp;`.
   - Revoke public direct INSERT on `audience_votes`; revoke EXECUTE on spectator RPCs from `PUBLIC`, `anon`, and `authenticated` (granting strictly to `service_role`); enforce vote intake exclusively through `/api/game/spectator` server route using Service Role with server-derived session/IP hashes.
   - Enforce active-player exclusion in `cast_spectator_vote` via `public.quest_submissions` (checking `pending` status or recent submissions within 30 minutes).
   - Implement DB trigger `trg_enforce_spectator_vote_limit` to enforce `max_votes_per_session` at PostgreSQL level.
   - Define strict RLS policies (distinguishing explicit client policies from server-mediated table writes), `uq_spectator_vote_session_number`, and partial unique index `uq_single_active_audience_event`.

3. **TypeScript Domain Types (`lib/types.ts`)**:
   - Add interfaces for `AudienceEvent`, `PublicAudienceEvent`, `AudienceEventOption`, `PublicAudienceEventOption`, `AudienceVote`, `PublicFeedItem`, `HostBroadcast`, `SpectatorSession`, `SpectatorSystemSettings`.

4. **Core Game Engine Extensions (`lib/game-engine.ts`)**:
   - Add functions: `createAudienceEvent()`, `getAudienceEvents()`, `submitAudienceVote()`, `resolveAudienceEvent()`, `getPublicGameFeed()`, `convertSpectatorToPlayer()`, `toggleSpectatorSystemFreeze()`.

5. **API Routes (`app/api/game/spectator/route.ts`)**:
   - Create GET/POST endpoints for spectator feed retrieval, session registration with age/safety parameters, and vote submissions with dependency-free sliding-window IP rate-limiting.

6. **Unit Tests (`tests/phase5.1-spectator-engine.test.ts`)**:
   - Create test suite validating vote tallying, duplicate vote prevention, vote count limit enforcement, public view sanitization (`public_audience_events` and `public_audience_event_options`), option payload masking, minor privacy protection defaults, admin authorization enforcement, and spectator conversion.

## ACCEPTANCE CRITERIA
- `/admin/live` access and GM actions require server-only admin session authorization (no client secret bundling or hardcoded production fallback secrets).
- `public.players` role column modification is hardened against client self-elevation in the database schema.
- `public_game_feed` public read RLS policy strictly enforces `is_public_feed_eligible = true AND is_minor_participant = false` at the database read boundary.
- Migration SQL syntax is valid PostgreSQL with `SET search_path = public, pg_temp;` on all `SECURITY DEFINER` RPCs and correct privilege grant ordering.
- `npm run lint` passes with 0 warnings or errors.
- `npm test` passes all existing tests plus new spectator tests.
- Zero breaking changes to existing player or live director features.