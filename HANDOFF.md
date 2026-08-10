# CANTON QUESTS — PHASE 5.1 SPECTATOR CORE ENGINE HANDOFF

## 1. Mission Understanding
Phase 5.1 Spectator Core Engine + Database + Security Foundation implements a trustworthy backend and database foundation for spectator sessions, public sanitized game feeds, audience events, options, voting, effects, host broadcasts, Game Master controls, and server-authorized admin control boundaries.

This foundation prepares the system for future Phase 5.2 public `/watch` UI work without requiring database schema redesigns, risking data leaks, or violating product principles.

---

## 2. Independent Review Findings & Complete Remediations

### Finding 1: Privilege Escalation Protection on Player Role Insert & Update (Remediated)
- **Problem**: In the initial spectator migration, `trg_protect_player_role` was configured as `BEFORE UPDATE ON public.players` to prevent role modifications. However, the Phase 1 `players` table `INSERT` RLS policy allowed `WITH CHECK (true)`, which created a vulnerability where an authenticated caller could insert a row setting `role = 'admin'` to satisfy RLS policies checking `players.role = 'admin'`.
- **Remediation**:
  1. Updated `supabase/migrations/20260809400000_phase5_spectator_engine.sql` to drop the open Phase 1 `INSERT` policy and replace it with:
     ```sql
     CREATE POLICY "Users can insert their own player profile" ON public.players
         FOR INSERT
         WITH CHECK (
             (auth.uid() = user_id OR user_id IS NULL)
             AND (role IS NULL OR role = 'player')
         );
     ```
  2. Upgraded `prevent_player_role_self_elevation()` and `trg_protect_player_role` trigger in SQL to execute `BEFORE INSERT OR UPDATE ON public.players`, explicitly rejecting non-service-role attempts to set privileged roles (`'admin'` or `'partner'`) on both `INSERT` and `UPDATE`.

### Finding 2: Environment Variable Template Secret Configuration (Remediated)
- **Problem**: `.env.example` omitted placeholders and documentation for `ADMIN_SECRET_KEY` (required for Game Master authentication) and `SPECTATOR_SESSION_SECRET` (required for fail-closed production spectator hashing).
- **Remediation**:
  Updated `.env.example` to document `ADMIN_SECRET_KEY` and `SPECTATOR_SESSION_SECRET` under explicit security section headings.

### Finding 3: Database Integrity Tests & Test Coverage Expansion (Remediated)
- **Problem**: Migration tests needed explicit verification of the newly added player role INSERT policy and BEFORE INSERT OR UPDATE trigger constraints.
- **Remediation**:
  Updated `tests/phase5.1-spectator-engine.test.ts` to include explicit structural SQL assertions verifying the `INSERT` policy and `BEFORE INSERT OR UPDATE` trigger on `public.players`. All unit and integration tests pass cleanly.

### Finding 4: Database-Level Single Vote Per Spectator Per Event Invariant (Remediated)
- **Problem**: The database unique constraint was previously defined as `(audience_event_id, session_token_hash, vote_number)`, which allowed vote numbers 1, 2, etc. if `max_votes_per_session` was configured above 1 or unconstrained.
- **Remediation**:
  1. Updated `supabase/migrations/20260809400000_phase5_spectator_engine.sql` to enforce `CONSTRAINT uq_spectator_one_vote_per_event UNIQUE (audience_event_id, session_token_hash)` on `public.audience_votes` and `CHECK (max_votes_per_session = 1)` on `public.audience_events`.
  2. Enforced strict 1 vote per session in `lib/spectator-engine.ts`, `lib/spectator-db.ts`, and `app/api/admin/live/route.ts`.
  3. Added explicit negative test in `tests/phase5.1-spectator-engine.test.ts` proving that a second vote from the same session is strictly rejected even if an event creation attempt requests `maxVotesPerSession: 2`.

---

## 3. Files Created & Modified

### Files Created:
- `lib/spectator-db.ts` (Supabase database service layer with real DB persistence and fail-closed security)
- `app/api/admin/live/route.ts` (Server API route for Game Master live director actions)
- `supabase/migrations/20260809400000_phase5_spectator_engine.sql` (Phase 5.1 spectator engine migration with hardened RLS policies, RPCs, views, and role protection triggers)
- `HANDOFF.md` (Mission handoff documentation)

### Files Modified:
- `.env.example` (Added `ADMIN_SECRET_KEY` and `SPECTATOR_SESSION_SECRET` documentation)
- `supabase/migrations/20260809400000_phase5_spectator_engine.sql` (Hardened `public.players` INSERT policy and BEFORE INSERT OR UPDATE role trigger)
- `app/api/game/spectator/route.ts` (Hardened player auth via Supabase Auth JWT, connected to spectator DB service layer, rate limiting, and session cookies)
- `lib/spectator-engine.ts` (Added `sanitizeTextContent()`, double-sanitized public game feed and host broadcast read/write boundaries)
- `lib/spectator-db.ts` (Sanitized public feed & host broadcast read/write boundaries, mapped full `audience_effects` audit metadata)
- `app/admin/page.tsx` (Gated data fetching and component state initialization behind server session verification)
- `app/admin/live/page.tsx` (Gated data fetching and 5s polling behind server session verification)
- `lib/types.ts` (Updated `AudienceEffect` and `AudienceEffectStatus` types with full audit attributes)
- `tests/phase5.1-spectator-engine.test.ts` (Added player role INSERT protection checks, host broadcast sanitization tests, admin auth tests)
- `DATABASE.md` (Updated canonical database documentation for Phase 5.1 spectator tables, security barrier views, and sanitization boundaries)
- `DECISIONS.md` (Added ADR-013 and ADR-014 documenting player auth hardening, text sanitization, audience effect audit shape, and admin client state gating)

---

## 4. Verification & Command Evidence

All verification commands executed cleanly with 0 errors:

1. **Git Check**:
   `git diff --check` -> PASSED (0 whitespace issues)

2. **TypeScript Compilation**:
   `npx tsc --noEmit` -> PASSED (0 type errors)

3. **Vitest Unit Test Suite**:
   `npm test` -> PASSED (7 test files passed, 61 total tests passed, 0 failed)
   - `phase1-playable-core.test.ts` (8 passed)
   - `phase1.5-backend-multiplayer.test.ts` (4 passed)
   - `phase2-realworld-game.test.ts` (8 passed)
   - `phase3-live-weekend.test.ts` (8 passed)
   - `phase4-event-factory.test.ts` (8 passed)
   - `phase5.1-spectator-engine.test.ts` (23 passed)
   - `foundation.test.ts` (2 passed)

4. **ESLint**:
   `npm run lint` -> PASSED (0 warnings, 0 errors)

5. **Next.js Production Build**:
   `npm run build` -> PASSED (Compiled successfully, optimized production build completed)

---

## 5. Answers to Mandatory Security Review Questions

1. **Can an anonymous browser read `spectator_sessions`?**
   **NO.** RLS policy `Admin view all spectator sessions` restricts direct table reads strictly to users with `players.role = 'admin'`. Direct public SELECTs and RPC execution are revoked.

2. **Can an anonymous browser read raw `audience_effects` payloads?**
   **NO.** Direct table reads are restricted strictly to GM Admins via RLS policy `Admin access only for audience effects`. Public views do not expose raw internal payloads.

3. **Can an anonymous user invoke Game Master effect application?**
   **NO.** GM effect application endpoints (`/api/admin/live` with `action: resolve_audience_event`) require server-verified admin authorization (`verifyServerAdminAuth`).

4. **Can a spectator vote twice in one audience event?**
   **NO.** Enforced by database unique constraint `CONSTRAINT uq_spectator_one_vote_per_event UNIQUE (audience_event_id, session_token_hash)`, `max_votes_per_session = 1` check constraint on `audience_events`, PostgreSQL trigger `trg_enforce_spectator_vote_limit`, server route checks, and in-memory engine validation.

5. **Can a spectator vote using an option from another event?**
   **NO.** Enforced by composite database foreign key `CONSTRAINT fk_vote_option_event FOREIGN KEY (option_id, audience_event_id) REFERENCES public.audience_event_options(id, audience_event_id)` and server logic.

6. **Can two audience votes be `voting_active` simultaneously for the same game event if architecture prohibits this?**
   **NO.** Enforced by database partial unique index `uq_single_active_audience_event ON public.audience_events (event_id) WHERE (status = 'voting_active')`.

7. **Can public feed consumers receive exact live player location?**
   **NO.** Exact coordinates are mapped to coarse district names (`mapCoordinatesToDistrict`), coordinates in raw text are redacted via `sanitizeTextContent` at write and read boundaries, and a 2-minute delay buffer is applied to gameplay completions.

8. **Can future `/watch` consume sanitized data without requiring service-role credentials in the browser?**
   **YES.** Public clients read from double-sanitized security barrier views (`public_audience_events`, `public_audience_event_options`, `public_host_broadcasts`) and `public_game_feed` using standard anon/authenticated roles.

9. **Does the Game Master retain the ability to cancel/override audience influence?**
   **YES.** The Game Master can manually resolve events with override options, freeze the spectator system globally via `toggle_spectator_freeze`, or set events to `cancelled`/`overridden`.

10. **Does spectator participation remain non-pay-to-win?**
    **YES.** All spectator voting is free, rate-limited per session/IP, and strictly governed by Game Master options.

---

## 6. Recommended Next Mission
**PHASE 5.2 — PUBLIC /WATCH SPECTATOR EXPERIENCE**
- Build the public spectator UI at `/watch`.
- Implement live audience voting component consuming `/api/game/spectator?action=events` & `options`.
- Render real-time public game feed and host broadcasts.
- Add age & safety consent onboarding modal for walk-up spectator-to-player conversion.
