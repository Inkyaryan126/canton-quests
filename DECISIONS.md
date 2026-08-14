# Canton Quests — Architecture & Product Decision Log (ADRs)

---

## Decision Record Format

Each entry follows the standard ADR structure:
- **Date**: YYYY-MM-DD
- **Decision**: Concise title of the decision.
- **Reason**: Rationale and underlying problem being addressed.
- **Alternatives Evaluated**: Options considered before deciding.
- **Consequences**: Downstream impacts, trade-offs, or constraints created.
- **Status**: `PROPOSED`, `ACCEPTED`, `SUPERSEDED`, or `REJECTED`.

---

## ADR-001: Launch Location Selection
- **Date**: 2026-08-09
- **Decision**: Canton, Ohio is confirmed as the initial launch city and testing ground for Canton Quests.
- **Reason**: Canton provides a rich mix of walkable downtown arts districts, historic landmarks (McKinley Monument, Pro Football Hall of Fame heritage), active local business networks, and manageable geographic scale ideal for refining a real-world game engine.
- **Alternatives Evaluated**: Generic virtual sandbox, large metropolis (Chicago/NYC) with high noise/cost barriers.
- **Consequences**: Initial quest content, spatial bounding boxes, and merchant partnerships will focus exclusively on Canton.
- **Status**: **ACCEPTED**

---

## ADR-002: Product Identity — City Game vs. Scavenger Hunt SaaS
- **Date**: 2026-08-09
- **Decision**: Canton Quests is engineered and branded as an immersive, real-world city game layered over Canton, NOT as a white-label B2B scavenger hunt SaaS application.
- **Reason**: Scavenger hunt software is a commoditized, sterile utility. Canton Quests succeeds by creating excitement, mystery, community events, and real-world urban adventure.
- **Alternatives Evaluated**: Building a white-label SaaS form builder for corporate retreats.
- **Consequences**: All UX patterns, copy, visual styling, and event features must maintain an urban adventure feel. Generic SaaS templates are prohibited.
- **Status**: **ACCEPTED**

---

## ADR-003: Multi-Category Scoring for Partial-Weekend Player Equity
- **Date**: 2026-08-09
- **Decision**: Implement a multi-category scoring engine (e.g. Single-Day Saturday Sprint, Master Decoder, Local Explorer) alongside overall weekend point totals.
- **Reason**: Awarding victory strictly to whoever plays for 48 consecutive hours alienates casual players, couples, families, and players available for only one day.
- **Alternatives Evaluated**: Single cumulative weekend points leaderboard.
- **Consequences**: Leaderboard backend and UI must present category rankings clearly so partial-weekend players have meaningful, achievable goals.
- **Status**: **ACCEPTED**

---

## ADR-004: Architecture Prepared for Eventual Multi-City Expansion
- **Date**: 2026-08-09
- **Decision**: Architect database schemas and API routes to isolate city-specific configuration (`cities` table, spatial boundaries) from core game engine logic.
- **Reason**: Prevents technical debt and hardcoded assumptions when expanding to future cities (*Akron*, *Cleveland*, etc.) after Canton's launch.
- **Alternatives Evaluated**: Hardcoding Canton geography directly in application code.
- **Consequences**: All database tables require `city_id` or `event_id` foreign keys; map view components accept dynamic spatial boundary parameters.
- **Status**: **ACCEPTED**

---

## ADR-005: Safety Embedded Into Quest Architecture
- **Date**: 2026-08-09
- **Decision**: Safety parameters (curfew hours, speed locks, public boundary checks) are enforced programmatically in quest design and verification services.
- **Reason**: Real-world gameplay creates inherent physical risks. Disclaimers alone are insufficient; the system must actively prevent hazardous quests.
- **Alternatives Evaluated**: Relying solely on a TOS waiver signed during account creation.
- **Consequences**: Quests undergo mandatory automated and manual safety checks before publishing; app locks out verification when moving >15 mph.
- **Status**: **ACCEPTED**

---

## ADR-006: Non-Pay-To-Win Monetization Policy
- **Date**: 2026-08-09
- **Decision**: Microtransactions that sell points, leaderboard positioning, or quest skips are permanently banned. Monetization is limited to ticket passes, physical swag, sponsor quest activations, and private event packages.
- **Reason**: Pay-to-win mechanics destroy competitive integrity, community trust, and player motivation.
- **Alternatives Evaluated**: Selling hint packs or point boosters.
- **Consequences**: Revenue models focus on ticket tiers, merchant partner packages, and sponsor activations.
- **Status**: **ACCEPTED**

---

## ADR-007: Folder Naming Convention (`canton-quests`)
- **Date**: 2026-08-09
- **Decision**: Use kebab-case `canton-quests` for the physical filesystem directory and repository name, while displaying human-readable "Canton Quests" across documentation, brand titles, and UI text.
- **Reason**: Kebab-case avoids whitespace escaping issues across POSIX terminals, Git tools, npm packages, Docker build steps, and CI/CD automation pipelines.
- **Alternatives Evaluated**: Folder with spaces (`Canton Quests`).
- **Consequences**: Directory operations use `canton-quests`; code metadata (`package.json`) uses `"name": "canton-quests"`.
- **Status**: **ACCEPTED**

---

## ADR-008: Playable Core Game Engine & Verification Ledger
- **Date**: 2026-08-09
- **Decision**: Phase 1 implements a lightweight hybrid game engine supporting Supabase PostgreSQL with PostGIS extensions & RLS policies, paired with an integrated local storage fallback so the full game loop (event discovery, player setup, quest detail, 5 proof verification types, score ledger, leaderboard, QR gateway, admin control room) is immediately playable, testable, and persistable out-of-the-box.
- **Reason**: Ensures frictionless zero-credential local development and continuous automated testing without blocking core game development on external database credentials.
- **Alternatives Evaluated**: Blocking development until remote Supabase instance credentials are explicitly supplied.
- **Consequences**: Production migration SQL (`supabase/migrations/20260809000000_phase1_playable_core.sql`) is stored for remote deployments while dev engine handles instant local state.
- **Status**: **ACCEPTED**

---

## ADR-009: Launch Event Schedule — September 4th, 2026
- **Date**: 2026-08-09
- **Decision**: Confirm September 4th, 2026 as the official launch date for *Canton Quests: Volume 1 — The Founder's Cipher*.
- **Reason**: Provides a 3-week operational runway to secure community donations, business partner sponsorships, and local prizes. Furthermore, aligns with the Stark County Fair (starting Sept 1st), enabling high-density physical flyer distribution and player acquisition leading directly into launch weekend (Sept 4–7).
- **Alternatives Evaluated**: Immediate August release without sponsor prep; late autumn release after outdoor weather window closes.
- **Consequences**: Production seed events, countdown timers, marketing copy, and launch runbooks will default to the September 4, 2026 start time.
- **Status**: **ACCEPTED**

---

## ADR-010: Spectator Mode Architecture, Public View Isolation, Minor Protections & Server-Mediated Voting
- **Date**: 2026-08-09
- **Decision**: Architect public spectator mode (`/watch`) with double-sanitized public security barrier views (`public_audience_events` masking internal admin user IDs, target secrets, and override notes; `public_audience_event_options` masking `effect_payload`), direct table access on `audience_events` and `audience_event_options` restricted strictly to GM Admins (`role = 'admin'`), mandatory minor privacy protections (`is_minor = true` forcing anonymized handles `Agent #XXXX` and suppressing public photo/media exposure), 2-step Age & Safety Gate onboarding for walk-up conversion, server-mediated voting via RPC (`cast_spectator_vote`) with `EXECUTE` revoked from public roles and granted strictly to `service_role`, server-derived session/IP hashes via `/api/game/spectator`, active-player exclusion via `public.quest_submissions`, database trigger limit enforcement (`max_votes_per_session`), 2-minute district-aggregated location delays, and zero-friction walk-up conversion funnels.
- **Reason**: Direct public table reads or un-isolated RPC execution allow vote forgery, expose raw admin user IDs/internal target secrets, and bypass session limits. Unfiltered event/option views leak hidden Host game plans and unreleased quest targets. Default exposure of minor player handles or media violates real-world player safety rules. District-level delays prevent real-world stream-sniping and player stalking.
- **Alternatives Evaluated**: Allowing public client direct table SELECTs/INSERTS on raw `audience_events` or `audience_votes`; exposing public execution of RPCs with client-supplied hashes; exposing raw target names and admin user IDs to public clients; publishing exact GPS coordinates in real-time.
- **Consequences**: Public clients query event and option data exclusively via `public_audience_events` and `public_audience_event_options` views. Public clients submit votes exclusively via `/api/game/spectator` server endpoint, which derives session token hashes and IP hashes server-side before calling `cast_spectator_vote` using Service Role. Under-18 accounts are strictly anonymized across all public feeds/leaderboards. Public feed displays district names only with a mandatory delay.
- **Status**: **ACCEPTED**

---

## ADR-011: Server-Only Admin Security Boundary & Safe SECURITY DEFINER RPC Specs
- **Date**: 2026-08-09
- **Decision**: Enforce a strict server-only admin authentication boundary for `/admin/live` and Game Master API endpoints, and mandate explicit `SET search_path = public, pg_temp;` on all database `SECURITY DEFINER` functions. Client components on `/admin/live` or `/admin` must NOT import or bundle secret-verifying logic (`verifyAdminSecret`), passphrases, or hardcoded default secrets into browser JavaScript.
- **Reason**: Bundling admin secret verification functions into browser code bakes secret strings into public client JS assets, allowing secret discovery and unauthorized endpoint execution via `x-admin-key` headers. Defining `SECURITY DEFINER` RPCs without a locked `search_path` exposes the database to schema-shadowing attacks in PostgreSQL.
- **Alternatives Evaluated**: Validating admin passphrases in client components using localStorage and client secret helpers; creating `SECURITY DEFINER` functions without `search_path` locks.
- **Consequences**: Game Master authentication is processed exclusively via server endpoints/Server Actions (`/api/admin/login`, `/api/admin/session`) setting secure HTTP-only cookies. Production secret verification relies solely on `process.env.ADMIN_SECRET_KEY` evaluated server-side. All `SECURITY DEFINER` RPC definitions specify `SET search_path = public, pg_temp;`.
- **Status**: **ACCEPTED**

---

## ADR-012: Database Admin Role Hardening & Public Feed DB Read Boundary Protection
- **Date**: 2026-08-09
- **Decision**: (1) Require database schema hardening on `public.players` in Phase 5.1 to preserve `user_id`-based profile ownership (`USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL)`) and attach a PostgreSQL trigger (`trg_protect_player_role`) blocking non-`service_role` role self-elevation. (2) Require the `public_game_feed` table's public read RLS policy to enforce `is_public_feed_eligible = true AND is_minor_participant = false` alongside `published_at <= NOW() AND is_retracted = false`.
- **Reason**: (1) Database RLS policies relying on `players.role = 'admin'` are bypassable if clients can update their own `players.role` column directly via Supabase client requests. (2) Relying solely on application-level filtering for minor involvement and feed eligibility creates data leak risks if an un-sanitized or minor record is inserted; privacy and minor protections must be enforced at the database read boundary.
- **Alternatives Evaluated**: Trusting client-side `players.role` updates; enforcing minor/eligibility filters strictly in frontend component logic or API serializers.
- **Consequences**: `players.role` cannot be modified by standard client update calls. Database RLS policies checking `players.role = 'admin'` are securely backed by PostgreSQL schema constraints. Direct Supabase SELECT queries on `public_game_feed` by public clients automatically suppress ineligible and minor participant rows.
- **Status**: **ACCEPTED**

---

## ADR-013: Hardened Player Identity Verification, Public Feed Sanitization Boundary & Extended Audience Effect Audit Shape
- **Date**: 2026-08-09
- **Decision**:
  1. Enforce strict cryptographic JWT verification (`supabase.auth.getUser`) for authenticated player claims in spectator endpoints (`/api/game/spectator`). Raw unauthenticated player UUID token matching directly against the `players` table is prohibited to prevent player impersonation.
  2. Enforce a mandatory text sanitization boundary (`sanitizeTextContent`) across all public feed outputs (`sanitizeActivityItem`) to strip emails, phone numbers, exact lat/lon coordinates, secret codes/passphrases, admin notes, IP/token hashes, and private proof URLs.
  3. Extend the `audience_effects` schema and domain interfaces to support full lifecycle status (`pending`, `applied`, `failed`, `cancelled`, `overridden`), resolution timestamps (`resolved_at`), cancellation reasons (`cancellation_reason`), override context (`override_context`), and administrative attribution (`created_by`, `applied_by`, `resolved_by`).
- **Reason**:
  - Accept raw player UUID strings as authenticated player IDs allowed anonymous browsers to forge player identities and bypass active-player exclusions or impersonate players during spectator conversion.
  - Direct concatenation of raw activity details into public feed items risked exposing sensitive location or contact metadata.
  - The spectator architecture audit requires complete GM auditability and lifecycle overrides for audience-generated effects.
- **Alternatives Evaluated**: Trusting `x-player-token` header strings without JWT validation; allowing raw activity text in public feed; maintaining minimal 3-state `audience_effects`.
- **Consequences**:
  - Player authentication in spectator routes strictly requires valid Supabase Auth JWTs.
  - All public game feed items pass through `sanitizeTextContent` before public publication.
  - `audience_effects` table and domain model store complete audit records for all effect applications, resolutions, and manual overrides.
- **Status**: **ACCEPTED**

---

## ADR-014: Double-Sanitized Public Feed/Broadcast Boundaries & Admin Client State Security Gating
- **Date**: 2026-08-09
- **Decision**:
  1. Mandate `sanitizeTextContent` at both write (insertion) and read boundaries for `public_game_feed` and `host_broadcasts` in both standalone engine (`spectator-engine.ts`) and database service layers (`spectator-db.ts`). Public spectators receive text output stripped of emails, phone numbers, exact lat/lon coordinates, secret passphrases, admin notes, IP/token hashes, and private proof URLs regardless of upstream input source.
  2. Gate admin page component data loading (`app/admin/page.tsx` and `app/admin/live/page.tsx`) strictly behind server-verified session checks (`/api/admin/session`). Unauthenticated visitors receive 0 privileged game data in React component state, and background polling is disabled until server authorization succeeds.
- **Reason**:
  - Writing raw broadcast copy or reading un-sanitized feed rows directly from database tables presented potential data leak risks if upstream GM text contained sensitive coordinates, codes, or contact details.
  - Initializing client component state with administrative game data prior to session verification exposed privileged event data in browser memory to unauthenticated visitors.
- **Alternatives Evaluated**: Relying solely on RLS for text sanitization; populating admin state on mount before server authentication check finishes.
- **Consequences**:
  - All public feed and host broadcast items pass through text sanitization at both store/insert and public read boundaries.
  - `/admin` and `/admin/live` client components maintain zeroed state and zero polling when unauthenticated, strictly enforcing server session verification via `/api/admin/session`.
- **Status**: **ACCEPTED**

---

## ADR-015: Database-Enforced Single Vote Per Spectator Per Audience Event Invariant
- **Date**: 2026-08-09
- **Decision**: Enforce a strict single-vote-per-spectator-per-event invariant at the database schema level via `CONSTRAINT uq_spectator_one_vote_per_event UNIQUE (audience_event_id, session_token_hash)` on `public.audience_votes` and `CHECK (max_votes_per_session = 1)` on `public.audience_events`.
- **Reason**: The previous unique constraint `(audience_event_id, session_token_hash, vote_number)` allowed vote numbers 1, 2, etc. if `max_votes_per_session` was configured > 1 or unconstrained, contradicting the nonnegotiable product principle that a spectator cannot vote multiple times in the same audience event.
- **Alternatives Evaluated**: Allowing configurable `max_votes_per_session > 1` per event type; relying solely on trigger checks.
- **Consequences**: PostgreSQL schema guarantees that no spectator session token hash can ever record more than one vote row for a given audience event. Attempts to insert duplicate votes fail instantly at the database level with a `unique_violation`.
- **Status**: **ACCEPTED**

---

## ADR-016: Authoritative Core Quest Rewards Backbone, Public Security Sanitization, Mandatory GPS Location Verification & Multi-Step Sequence Protection
- **Date**: 2026-08-12
- **Decision**:
  1. Enforce an authoritative quest proof verification and reward issuance engine where verified proof awards persistent XP and event-scoped drawing entries exactly once per quest per player.
  2. Enforce mandatory GPS location coordinates (`userLat`, `userLon`) and distance radius checks for `gps` verification type and quests with `requireLocationVerification: true`. Submissions without coordinates or outside the location radius are rejected with zero rewards.
  3. Enforce sequential step order verification (`completedStepOrder`) for multi-step quests (`verificationType = 'multi_step'`). Submissions out of order or with invalid step codes are rejected, and rewards are issued only upon final step completion.
  4. Double-sanitize public quest reads via `getPublicQuestView` in all public APIs (`/api/game/events/[slug]`) and React client components (`app/events/[slug]/quests/[questId]/page.tsx`), stripping secret passphrases/codes (`targetCode`), internal GM notes (`gmNotes`), and step target codes before exposure to the browser.
  5. In database migrations, replace raw public ledger reads with sanitized projection views (`public_drawing_ledger_projection`) exposing public player display labels (`display_name` / `Agent #XXXX`), total entries, and lock metadata without exposing sensitive player UUIDs, submission IDs, or internal GM notes.
  6. In Supabase-configured environments, proof submission uses a server-authoritative service-role path with Supabase Auth JWT identity resolution. If the server cannot verify identity or lacks service-role configuration, the submission fails closed instead of delegating to the local engine.
  7. Positive quest-completion XP idempotency is enforced at the database layer with a partial unique index on quest-completion score ledger rows, separate from manual/admin/bonus score categories.
- **Reason**:
  - Exposing secret target codes or GM notes in public API routes or React state allowed players to bypass puzzle challenges.
  - Allowing GPS auto-verification without location coordinates or distance checking permitted players to claim rewards without physically visiting real-world locations.
  - Allowing multi-step step index skipping permitted players to bypass intermediate puzzle steps.
  - Exposing raw drawing ledger rows leaked player identities and submission links in public database queries.
  - Falling back to the local in-memory engine while Supabase was configured allowed browser-supplied identity and reward state to influence production reward issuance.
- **Alternatives Evaluated**: Relying solely on client-side button disables for GPS verification; returning full quest objects with target codes to client components; exposing raw drawing ledger tables to public RLS policies.
- **Consequences**: Public API routes and client pages consume strictly sanitized quest objects. GPS verification requires active location coordinates within the specified radius. Multi-step progression is enforced server-side. Database tables enforce unique constraints (`uq_player_event_quest_drawing`, `uq_score_quest_completion_xp`) and sanitized projection views. Supabase reward issuance requires authenticated player identity and service-role writes; local fallback is limited to unconfigured development/test environments.
- **Status**: **ACCEPTED**

---

## ADR-017: Transparent Prize Drawing System, Immutability, Canonical SHA-256 Ledger Locks & Single Primary Prize Per Player Rule
- **Date**: 2026-08-12
- **Decision**:
  1. Enforce a transparent, auditable prize drawing system operating over the frozen drawing entry ledger.
  2. Implement canonical snapshot export (`exportDrawingLedgerSnapshot`) with strict, deterministic ordering (`publicPlayerLabel` ASC, `entries` ASC) independent of database return order, serialized as canonical JSON and cryptographically hashed with real SHA-256 (`sha256:...`).
  3. Enforce fail-closed drawing ledger locking (`lockDrawingLedger`). Post-lock, normal quest reward issuance cannot add new entries for that event, and prior entries cannot be edited. Database triggers (`trg_prevent_locked_drawing_ledger_edits`) enforce this at the schema boundary.
  4. Require Game Master review before locking. Warn if unresolved pending submissions exist, requiring explicit admin confirmation (`confirmPendingBypass`) to lock while pending submissions remain.
  5. Decouple drawing provider logic via `DrawProvider` abstraction. Implement `InternalTestDrawProvider` using explicit test seeds (`TEST_SEED:...`) for reproducible weighted winner selection.
  6. Enforce weighted entry math: a player with 5 entries holds 5 weighted range units, mathematically preserving 5:1 odds over a 1-entry player.
  7. Adopt the single primary prize per player rule: winning a primary event drawing prize removes that player from subsequent primary prize pools for that event drawing session.
  8. Public drawing projections and public result pages (`/events/[slug]/drawing` & `/api/game/events/[slug]/drawing`) display strictly privacy-safe public labels (`Agent #XXXX` or sanitized display names), total entries, lock timestamp, and snapshot hash without exposing internal player UUIDs, auth user IDs, emails, phone numbers, submission IDs, or proof URLs.
  9. Draw records (`prize_draw_records`) require explicit audit reasons to void or cancel, preserving historical records without silent overwrites.
- **Reason**:
  - Drawing systems in public events require verifiable proof that entry pools were frozen prior to winner selection and cannot be secretly altered post-draw.
  - Exposing raw player UUIDs, emails, or submission IDs in public drawing results violates player privacy and minor protection rules.
  - Database row ordering non-determinism caused non-reproducible snapshot hashes across queries.
- **Alternatives Evaluated**: Selecting winners on live un-frozen entry pools; relying on client-side random number generators; exposing internal player UUIDs on public winner pages; allowing silent draw result deletion.
- **Consequences**: Drawing entry pools are frozen with real SHA-256 hashes prior to drawing. Public drawing pages present auditable proof and privacy-safe winner labels. Game Master operations require authorization. Multiple prizes honor weighted units and 1-prize-per-player equity.
- **Status**: **ACCEPTED**

---

## ADR-018: High-Resolution Deterministic Promotional Flyer Generation & Automated Compositing Pipeline
- **Date**: 2026-08-13
- **Decision**:
  1. Add a dedicated, deterministic promotional flyer generation pipeline (`lib/qr-flyer-generator.ts`) integrated into the QR campaign CLI (`scripts/qr-campaign-cli.ts`).
  2. Implement strict category-to-master routing (`Family` -> `Family_Flyer_Master`, `Challenge` -> `Challenge_Flyer_Master`, `Secret` -> `Secret_Flyer_Master`).
  3. Define deterministic pixel coordinates and dimensions for the white placement boxes across all 3 master flyers (`Challenge`: 500x728 with box at left=313, top=504, width=155, height=143, qrSize=138; `Family`: 500x729 with box at left=343, top=514, width=127, height=129, qrSize=121; `Secret`: 500x729 with box at left=305, top=484, width=138, height=138, qrSize=132).
  4. Generate high-error-correction ('H') black-on-white QR codes using real canonical URLs (`https://www.divinedesigndestinations.com/go/<slug>`) without decorative distortions.
  5. Composite QR codes directly into master artwork using `sharp`, preserving original master artwork resolution without stretching.
  6. Generate deterministic, collision-resistant filenames (`01-family-dustin.png`, `02-challenge-steve.png`, etc.) and a standardized `manifest.csv` containing complete assignment metadata.
  7. Fail closed immediately with descriptive errors if any master image is missing, if a flyer type is unknown, or if any tracking URL is missing.
- **Reason**:
  - Street team marketing requires physical flyers with individual attribution tracking for distributors. Manual flyer production is slow, error-prone, and risks misaligned or distorted QR codes.
  - Fail-closed validation prevents accidental distribution of broken or misattributed marketing materials.
- **Alternatives Evaluated**:
  - Manual graphic design adjustments in Figma/Photoshop (unscalable, non-deterministic).
  - Client-side browser canvas rendering (unsuitable for headless CLI workflows and script automation).
- **Consequences**:
  - CLI command `npm run qr:campaign -- flyers --campaign "<name>" --masters "<path>" --output "<path>"` consumes authoritative active QR assignments and outputs finished, print-ready composite PNGs and `manifest.csv`.
- **Status**: **ACCEPTED**

