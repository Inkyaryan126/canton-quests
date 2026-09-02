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

## ADR-009: Launch Event Schedule — September 4th, 2026 (Preliminary / Historical)
- **Date**: 2026-08-09
- **Decision**: Confirm September 4th, 2026 as the preliminary launch date for *Canton Quests: Volume 1 — The Founder's Cipher*.
- **Reason**: Provided an initial target window aligned with the Stark County Fair (starting Sept 1st), enabling high-density physical flyer distribution and player acquisition leading directly into launch weekend (Sept 4–7).
- **Alternatives Evaluated**: Immediate August release without sponsor prep; late autumn release after outdoor weather window closes.
- **Consequences**: Production seed events, countdown timers, marketing copy, and launch runbooks initially defaulted to the September 4, 2026 start time.
- **Status**: **SUPERSEDED** (Superseded by ADR-029 establishing the official public launch date: September 11, 2026).

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

---

## ADR-019: Official Canonical Brand Identity & Deterministic Asset Standardization
- **Date**: 2026-08-13
- **Decision**:
  1. Establish `public/brand/canton-quests-master-logo.png` as the permanent, immutable canonical brand mark for Canton Quests. Redesigning, generative re-creation, or introducing alternate unapproved marks is permanently prohibited.
  2. Implement deterministic, non-generative derivative brand assets for small icon/emblem contexts:
     - `public/brand/canton-quests-mark.png` (920x920 square crop of the central interlocking CQ compass emblem)
     - `public/brand/canton-quests-mark-512.png` (512x512 PWA web app icon)
     - `public/brand/canton-quests-mark-192.png` (192x192 PWA web app icon)
     - `public/brand/canton-quests-apple-touch-icon.png` (180x180 iOS touch icon)
     - `public/brand/favicon.ico` (multi-resolution 16/32/48 ICO)
     - `public/brand/canton-quests-og.png` (1200x630 OpenGraph and Twitter card asset)
  3. Create a standardized, reusable Next.js component `<CantonQuestsLogo />` (`components/CantonQuestsLogo.tsx`) with strict aspect ratio preservation, Next/Image optimization, and support for `full` and `mark` variants.
  4. Standardize brand presentation across all headers (`CinematicNav`, `Header`), footers (`CinematicFooter`), metadata (`RootLayout`), PWA manifest (`public/manifest.json`), and printable sheets (`app/admin/qr/print/page.tsx`).
  5. Safely archive legacy low-resolution placeholder logo assets into `public/brand/archive/`.
- **Reason**:
  - Brand consistency, mobile recognition, outdoor readability, and professional visual polish require a single, immutable canonical identity asset across all digital and physical touchpoints.
- **Alternatives Evaluated**:
  - Allowing ad-hoc emoji placeholders (⚡), low-resolution temporary assets, or generative re-creations across different pages.
- **Consequences**:
  - All visual touchpoints across Canton Quests reference the canonical master asset or its deterministic derivatives via `CantonQuestsLogo` or `cqBrand`.
- **Status**: **ACCEPTED**

---

## ADR-020: The Final Quest Human-Readable Transparent Prize Drawing System
- **Date**: 2026-08-14
- **Decision**:
  1. Implement a human-readable, transparent winner-selection layer (The Final Quest Draw System) on top of the immutable, SHA-256 frozen drawing entry ledger.
  2. Establish the fixed, permanent Canton Quests number: `311420151417215192019` (derived from converting CANTON QUESTS with A=1..Z=26: C=3, A=1, N=14, T=20, O=15, N=14, Q=17, U=21, E=5, S=19, T=20, S=19). This number is permanently fixed in code and documentation and is never dynamically recomputed from editable marketing copy.
  3. Derive the Final Quest Number by multiplying predetermined, objectively frozen event totals (participating qualified players, total valid prize tickets, total verified completed quests, and full-event finishers) by `311420151417215192019`.
  4. Assign valid prize tickets deterministically from 1 to $N$ across players in canonical snapshot order ($[1..E_0]$, $[E_0+1..E_0+E_1]$, etc.).
  5. Determine ticket number width $W = \text{length}(N)$.
  6. Execute a left-to-right sliding window of width $W$ across the Final Quest Number (stepping 1 digit at a time). Leading zeros are valid ($092 = 92$), zero is invalid ($000$), numbers $> N$ are invalid. The first valid ticket encountered wins.
  7. If the forward scan yields no valid ticket, execute a secondary reverse scan (reversing the Final Quest Number). If the reverse scan also yields no valid ticket, execute a deterministic modulo fallback: $(\text{FinalQuestNumber} \pmod N) + 1$.
  8. Preserve the underlying SHA-256 cryptographic snapshot verification, ledger locking, single-primary-prize-per-player equity rule, and audit logs.
  9. Display complete public draw receipts on `/events/[slug]/drawing` enabling normal players to follow every step of winner selection without cryptographic expertise.
- **Reason**:
  - Pure cryptographic hashes (e.g. SHA-256 modular arithmetic) provide mathematical integrity but are opaque to non-technical players.
  - The Final Quest Draw System provides an intuitive, publicly verifiable trail that anyone with a pencil and paper can follow, verify, and trust.
- **Alternatives Evaluated**:
  - Live third-party random number generator APIs (introduces external runtime failure points).
  - Manual physical raffle wheels without deterministic public receipts.
  - Cryptographic hash modulus only (opaque to general public).
- **Consequences**:
  - Public drawing page presents both the human-readable Final Quest Receipt and the cryptographic SHA-256 snapshot for advanced audits.
  - Winner selection requires 0 human discretion and is 100% deterministic and reproducible.
- **Status**: **ACCEPTED**

---

## ADR-021: Live Game Operations & Spectator Influence Integration
- **Date**: 2026-08-14
- **Decision**:
  1. Turn the Phase 5.1 spectator backend and Phase 5.2 public `/watch` interface into a unified operational live-event system where audience decisions safely, deterministically, and idempotently affect the active game world under Game Master control without manual cross-system synchronization.
  2. Implement a deterministic audience decision lifecycle state machine:
     - `upcoming` / `scheduled` / `draft` $\rightarrow$ `voting_active` $\rightarrow$ `tallying_closed` $\rightarrow$ `resolved` (terminal), with terminal alternative states `cancelled` and `overridden`.
     - Invariant: Only 1 active voting event is permitted per event at any given time.
  3. Implement server-side Exactly-Once effect execution (`executeAudienceEffect`):
     - Applies verified gameplay consequences (`bonus_window` / `category_multiplier`, `flash_quest`, `secret_code`, `theatrical_broadcast`).
     - Idempotency guard: If an effect was already executed, repeated calls return `isDuplicatePrevented: true` and execute zero redundant ledger or score mutations.
  4. Implement Game Master Manual Override and Cancellation controls:
     - Override resolves the decision to a GM-selected option with audited attribution metadata and public announcement.
     - Cancellation immediately closes voting with zero gameplay consequences and public broadcast.
  5. Implement Automated Public Airwaves Broadcasting & In-Game Player Announcements:
     - Automatically publishes host broadcasts (`"THE AUDIENCE HAS SPOKEN"`, `"GAME MASTER OVERRIDE"`, `"AUDIENCE DECISION CANCELLED"`) upon lifecycle resolution.
     - Automatically creates in-game player notifications visible in `/quests` and player feeds.
  6. Implement Immutable Operational Event Timeline & Audit Trail (`LiveEventTimelineEntry`):
     - Records chronological log of all live events (`phase_change`, `audience_vote_opened`, `audience_vote_closed`, `audience_resolved`, `audience_overridden`, `audience_cancelled`, `spectator_freeze`, `effect_executed`, `flash_quest_triggered`).
  7. Implement Isolated Safe Rehearsal / Simulation Mode:
     - Allows Game Masters to simulate complete spectator voting flows, projected winners, and effect previews without mutating real production scoring, player history, prize ledger, or live drawing snapshots.
  8. Enhance Game Master Live Control Room (`/admin/live`) with a dedicated Audience Control section:
     - Active Decision monitor with live timer, vote bars, percentage distribution, projected winner, and 1-click action controls (Close Voting, Resolve, GM Override, Cancel, Freeze/Unfreeze).
     - Upcoming scheduled votes list, resolved decision history, rehearsal simulator controls, and filtered operational timeline.
     - Mobile-first responsive touch targets ($\ge 44\text{px}$) for 375px, 390px, and 430px smartphone viewports.
  9. Enforce all 14 spectator security invariants:
     - Anonymous walk-up spectator participation without authentication barriers.
     - Spectator sessions cannot submit arbitrary effect payloads or trigger mutations directly.
     - Zero service-role keys or database credentials exposed.
- **Reason**:
  - Bridging spectator voting to real in-game effects without server-side automation creates high cognitive load for field Game Masters and risks duplicate or desynchronized gameplay modifiers.
  - Strict idempotency and rehearsal isolation guarantee fair, glitch-free live event execution.
- **Alternatives Evaluated**:
  - Manual Game Master copy-pasting of spectator poll results into separate bonus window and quest forms (high human error risk).
  - Direct client-side spectator triggering of gameplay effects (critical security vulnerability).
- **Consequences**:
  - Audience votes seamlessly translate into live citywide game modifications under complete Game Master supervision.
- **Status**: **ACCEPTED**

---

## ADR-022: Live Event Readiness, Hard Server-Side Launch Gates & Launch Rehearsal Engine
- **Date**: 2026-08-14
- **Decision**:
  1. Turn the Canton Quests platform into an operationally robust, live-event validated system that can safely and reliably run real outdoor Canton events with zero unverified assumptions.
  2. Implement an Automated Event Readiness Health Report (`computeEventReadinessReport(eventId)`):
     - Computes real readiness statuses (`READY`, `WARNING`, `BLOCKED`, `NOT_CONFIGURED`) across 12 operational subsystems: Event Config, Quests & Chains, Locations & Bounds, Proofs, QR Codes, Scoring, Leaderboard, Spectator & `/watch`, Host Broadcasts, Audience Influence, GM Auth, and Prize/Drawing Isolation.
     - Calculates concrete overall launch assessments: `READY_FOR_LIVE_EVENT`, `READY_WITH_WARNINGS`, `NOT_READY`.
  3. Enforce Hard Server-Side Launch Gates (`evaluateEventLaunchGates(eventId)`):
     - Blocks event launch if the event is cancelled, missing, has $<3$ playable quests, contains duplicate QR code assignments, exposes target codes in public descriptions, has missing GPS bounds, or has contradictory emergency states.
  4. Implement Pre-Event Operator Checklist (`getOperatorChecklist`, `updateOperatorChecklistItem`):
     - Synchronizes automated system health checks with field physical verifications (e.g. signage placement, staff walkies, battery packs).
     - Enforces invariant: Manual operator checkboxes can never override an actual failing server-side gate.
  5. Implement QR & Quest Location Readiness Audit (`auditEventQRQuests`, `auditEventQuestsAndLocations`):
     - Audits active QR identifiers for duplicate collisions, foreign event associations, route availability, and secret exposures.
     - Validates quest point values, Canton coordinate bounds ($40.75 \le \text{lat} \le 40.85$, $-81.45 \le \text{lon} \le -81.30$), GPS radii ($15\text{m} \le r \le 500\text{m}$), and prerequisite cycle integrity.
  6. Implement Walk-Up Player Rehearsal Simulator (`runWalkUpPlayerRehearsal`):
     - Executes a 10-step simulated player lifecycle (arrival, player creation, quest selection, proof submission, XP reward, leaderboard standings, broadcast reception, session recovery) in a sandbox with `isRehearsal: true`, verifying zero mutations to production player records or score ledgers.
  7. Implement Full Event 8-Phase Progression Rehearsal Simulator (`runFullEventRehearsal`):
     - Simulates event lifecycle progression across all 8 phases (`pre_game` $\rightarrow$ `opening` $\rightarrow$ `day_1` $\rightarrow$ `night_round` $\rightarrow$ `day_2` $\rightarrow$ `final_hours` $\rightarrow$ `finale` $\rightarrow$ `ended`) with simulated players, quest submissions, spectator votes, GM overrides, emergency pause drills, and drawing snapshot isolation.
  8. Implement High-Visibility Emergency Operations & Safe Event Closure:
     - Prominent emergency pause / resume controls, spectator freeze / unfreeze controls, and urgent host broadcast triggers in `/admin/live`.
     - Graceful Event Closure (`executeEventClosure`): Transitions phase to `ended`, locks subsequent submissions (`EVENT_ENDED`), closes active spectator polls, publishes concluding host broadcast, and permanently preserves score ledgers and drawing snapshots.
  9. Mobile-first Game Master Control Dashboard:
     - Organized into high-contrast tabs: Readiness & Launch Gates, Operator Checklist, QR & Quest Audit, Audience Operations, Rehearsal Sandbox, Game Director, and Emergency & Closure with touch targets $\ge 44\text{px}$.
- **Reason**:
  - Live outdoor city events require automated launch gates and sandbox rehearsal drills to eliminate operational blindspots, configuration errors, and field panic.
- **Alternatives Evaluated**:
  - Relying on manual Game Master memory for pre-event readiness checks (high risk of human oversight).
  - Testing drills in production databases (risk of corrupting live player leaderboards and prize drawing ledgers).
- **Consequences**:
  - Field Game Masters possess complete real-time situational awareness, 1-click drill verification, and deterministic fail-safe emergency controls.
- **Status**: **ACCEPTED**

---

## ADR-023: Total Removal of Team / Squad System in Favor of Pure Individual Player Competition
- **Date**: 2026-08-14
- **Decision**:
  1. Complete removal of the team / squad system across the entire Canton Quests repository to align with the core product vision: Canton Quests is strictly an **INDIVIDUAL PLAYER** outdoor competition.
  2. Canonical operational model:
     $$\text{PLAYER} \rightarrow \text{QUEST} \rightarrow \text{PROOF / VERIFICATION} \rightarrow \text{XP} \rightarrow \text{INDIVIDUAL LEADERBOARD} \rightarrow \text{LIVE GAME EVENTS} \rightarrow \text{SPECTATOR INFLUENCE} \rightarrow \text{FINALE / DRAWINGS}$$
  3. Clean elimination of player-facing squad constructs:
     - Removed `Team`, `TeamMember`, and `TeamLeaderboardEntry` runtime interfaces from `lib/types.ts`.
     - Removed `teamId` and `teamName` fields from `LeaderboardEntry`, `PlayerEventProgress`, `SubmitProofParams`, `SubmitProofResult`, `QuestSubmission`, and `ScoreLedgerEntry`.
     - Removed team storage keys (`STORAGE_KEYS.TEAMS`, `STORAGE_KEYS.TEAM_MEMBERS`) and engine functions (`createTeam`, `joinTeamByCode`, `getTeamForPlayer`, `getTeamLeaderboardForEvent`).
     - Removed seed teams and members (`SEED_TEAMS`, `SEED_TEAM_MEMBERS`) from `lib/seed-data.ts`.
     - Deleted dead `components/TeamHub.tsx` component.
  4. Streamlined UI & Cockpits:
     - `components/Leaderboard.tsx`: Converted to clean, responsive, single-mode individual leaderboard.
     - `app/leaderboard/page.tsx`: Removed `teamEntries` state, active squads card, and team standings section.
     - `app/events/[slug]/page.tsx`: Removed `'teams'` active tab, Squad Operations section, and squad props.
     - `app/admin/live/page.tsx` & `app/admin/page.tsx`: Removed team leaderboard lookups, squad tabs, and replaced squad metrics with verified agent rankings and location metrics.
     - Copy updates across landing pages (`/start/challenge`, `/fair/challenge`, `/how-it-works`) emphasizing individual explorer archetypes and individual leaderboard supremacy.
  5. Preserved Marketing Campaign Attributions:
     - Clarified architectural boundary: Physical flyer distribution campaigns (e.g. `street_team` channel, `Canton Quests Street Team 2026`) are marketing attribution channels for promotional print flyers and NOT in-game teams. These remain 100% intact.
  6. Verified Empirical Proof:
     - Added comprehensive invariant suite `tests/phase5.6-individual-player-model.test.ts`.
     - All 19 test suites and 308 tests passing cleanly with zero errors.
- **Reason**:
  - Teams and join codes added unnecessary cognitive load, code bloat, and confusion for walk-up festival players and casual explorers. Pure individual player competition simplifies the rules, improves onboarding speed, and makes leaderboard standings immediately intuitive.
- **Alternatives Evaluated**:
  - Hiding team UI with CSS while preserving backend calculations (rejected: dead code debt and architectural ambiguity).
- **Consequences**:
  - Clean, cohesive, lightning-fast architecture with 0 team dependencies and pure individual player tracking.
- **Status**: **ACCEPTED**

---

## ADR-024: Player Identity, Profile Personalization, and Three-Path City Architecture
- **Date**: 2026-08-14
- **Decision**:
  1. **Canonical Product & Competition Flow**:
     $$\text{ACCOUNT} \rightarrow \text{PLAYER PROFILE} \rightarrow \text{STARTING PATH} \rightarrow \text{QUESTS ACROSS CANTON} \rightarrow \text{PROOF / VERIFICATION} \rightarrow \text{XP} \rightarrow \text{INDIVIDUAL LEADERBOARD} \rightarrow \text{ACHIEVEMENTS} \rightarrow \text{SPECTATOR INFLUENCE} \rightarrow \text{FINALE} \rightarrow \text{PRIZE ELIGIBILITY}$$
  2. **Fast Player Accounts & Optional Personalization**:
     - Fast player accounts are required to submit proofs, earn XP, unlock achievements, and rank on the city leaderboard.
     - 10-second fast callsign registration (`FastPlayerOnboardForm`, `/api/auth/register`, `/api/auth/login`, `/api/auth/me`).
     - Player profile customization is 100% optional: players may customize bio, motto/tagline, hometown, avatar icon, theme color accent, favorite playstyle, selected title flair, and minor privacy status (`app/profile/page.tsx`, `/api/player/profile`).
  3. **Three Starting Paths — Open City Grid Invariant**:
     - Canton Quests has three starting paths corresponding to approximate geographic starting districts in Canton to naturally distribute player traffic:
       - **FAMILY**: Downtown / Arts District (Centennial Plaza, 4th St Mural, Aura Craft Coffee, Canton Palace Theatre, The Onesto, Civic Seal).
       - **CHALLENGE**: Southwest / Central Athletic (Arcade Vault, Hall of Fame Marker, planned 9th St Skate Park).
       - **SECRET**: Northwest / Historical Mystery (McKinley Memorial Stone Stair Cipher, Frankenstein Monument at West Lawn, Founder's Three Locks sequential cipher).
     - **Open Grid Rule**: Starting paths determine where a player is encouraged to start; paths **NEVER** restrict which quests a player may complete. All players compete on **ONE individual citywide leaderboard** and can solve any quest across Canton in any sequence.
     - **Attribution Separation**: Player acquisition source (`family_flyer`, `challenge_flyer`, `secret_flyer`, `main_site`, specific QR campaign slug) is tracked independently from `selectedStartingPath`.
  4. **Dynamic Achievements Engine**:
     - Added canonical achievements catalog (`SEED_ACHIEVEMENTS`, `achievements` table, `player_achievements` table) rewarding diverse play styles:
       - Pathfinder (`pathfinder-family`, `pathfinder-challenge`, `pathfinder-secret`): First quest completed on starting path.
       - District Sweeps (`district-sweep-family`, `district-sweep-challenge`, `district-sweep-secret`): All active quests completed within a district.
       - Triple Threat (`triple-threat`): Solved missions across all three districts.
       - City Nomad (`nomad`): Solved missions across all three districts in a single day.
       - Day 1 Conqueror (`day-one-king`): Finished Day 1 ranked #1 in XP.
     - Real-time automatic evaluation hooked into `submitQuestProof` and Game Master `reviewSubmission` approvals.
  5. **Day 1 #1 XP Leader Bonus Engine (+5 Prize Entries)**:
     - Awarded after Day 1 concludes via authoritative GM trigger (`awardDay1XpLeaderBonus`, `/api/admin/day1-bonus`).
     - Awards `+5` entries to the transparent prize drawing ledger (`awardDrawingEntries`, `drawing_entry_ledger`) and the `day-one-king` achievement.
     - Idempotency guard: enforces exact 1-time execution per event.
     - Deterministic tie-breaker: earliest timestamp of achieving the top score wins.
     - Full rehearsal sandbox simulation support (`isRehearsal: true`).
  6. **District Content Auditing & Gap Reporting**:
     - Added `getDistrictContentSummary` and `getAllDistrictsContentSummary` reporting active quest count, total available XP, and specific district content gaps (e.g. 9th Street Skate Park and Mother Gooseland area field drops).
  7. **Launch Gate Verification**:
     - Added hard launch gates `GATE_THREE_PATH_ARCHITECTURE_READY` and `GATE_PLAYER_INDIVIDUAL_ARCHITECTURE` into `lib/event-readiness.ts`.
  8. **Verified Empirical Proof**:
     - Added comprehensive test suite `tests/player-identity-three-path-architecture.test.ts`.
     - All 20 test suites and 324 unit/integration tests passing cleanly.
- **Reason**:
  - Distributes physical foot traffic naturally across Canton while maintaining a single, unified citywide competition. Provides fast onboarding with delightful optional personalization and rich achievement rewards.
- **Alternatives Evaluated**:
  - Building three separate games or locking quests by path (rejected: fragments player base and violates the open city exploration vision).
  - Reintroducing team models (rejected: explicitly banned per ADR-023).
- **Consequences**:
  - Canton Quests functions as ONE cohesive game with THREE starting doors, transparent prize equity, and a mobile-first player profile experience.
- **Status**: **ACCEPTED**

---

## ADR-025: Authoritative Supabase Auth Integration, Cryptographic Email OTP, Safe Legacy Player Claiming, and Impersonation Elimination
- **Date**: 2026-08-14
- **Decision**:
  1. **Authoritative Identity Chain**:
     $$\text{SUPABASE AUTH USER (auth.users)} \rightarrow \text{players.user\_id} \rightarrow \text{players.id} \rightarrow \text{EVENT PROGRESS / SUBMISSIONS / XP / ACHIEVEMENTS / PRIZE ENTRIES}$$
     - A player's public callsign or display name is an identifier for public leaderboards and feeds; it is **NEVER** an authentication credential.
     - A client-supplied `playerId` or `canton_player_id` cookie alone can never authorize profile mutations, quest proof submissions, score adjustments, or prize awards.
  2. **Elimination of Insecure Login Paths**:
     - Removed `authenticatePlayer(identifier, password)` from `lib/game-engine.ts` which allowed anyone to impersonate players by entering public callsigns.
     - Updated `/api/auth/login` to require Supabase Email OTP (`send_otp` / `verify_otp`) or verified JWT sessions. Unverified callsign/email login attempts are strictly rejected with HTTP 401.
  3. **Passwordless Email OTP & Verified Session Flows**:
     - Created `lib/supabase-auth.ts` providing canonical OTP send (`sendEmailOtp`), OTP verification (`verifyEmailOtp`), session resolution (`resolveAuthenticatedSupabaseUser`, `resolveAuthenticatedPlayer`, `resolveAuthenticatedPlayerId`), and safe profile creation (`resolveOrCreatePlayerForAuthUser`).
     - Upgraded `FastPlayerOnboardForm.tsx` and `EnterGameModal.tsx` to 2-step passwordless verification (Callsign + Email $\rightarrow$ Magic Confirmation Code $\rightarrow$ Enter Canton Quests).
  4. **Safe Legacy Player Account Claiming**:
     - Players created prior to Supabase Auth integration are safely claimed when a player verifies ownership of their registered email address via Supabase Auth OTP (`LOWER(players.email) = LOWER(auth.email) AND players.user_id IS NULL`).
     - Preserves 100% of historical XP, quest completions, unlocked achievements, and prize drawing ledger entries.
     - Missing email accounts are never guessed; callsign collisions create independent player IDs rather than overwriting existing player profiles.
  5. **Fail-Closed Session Verification & Authorization**:
     - `/api/auth/me` resolves identity strictly from verified Supabase Auth tokens; if a `canton_player_id` cookie conflicts with the authenticated user, it fails closed.
     - `/api/player/profile` restricts profile modifications to the server-resolved player ID; forged client-supplied `body.playerId` attempts are rejected with HTTP 403.
     - `/api/game/submit` validates `Authorization: Bearer <token>` through `resolveAuthenticatedPlayerId`; forged claimant submissions are rejected with zero XP mutation.
     - Spectator session tokens (`cg_spec_token`) cannot be used as player auth.
  6. **Database Schema & RLS Hardening**:
     - Created migration `supabase/migrations/20260814010000_critical_player_auth_remediation.sql`.
     - Unique partial index `idx_players_user_id_unique` on `players(user_id) WHERE user_id IS NOT NULL`.
     - Index `idx_players_email_lower` on `players(LOWER(email))`.
     - Trigger `trg_prevent_player_user_id_tampering` preventing modification of `user_id` once established.
     - Hardened Row Level Security (RLS) policies on `public.players` and `public.quest_submissions`.
  7. **Public Privacy Protection**:
     - `sanitizePlayerForPublic` strips `email` and `user_id` from public leaderboards, activity feeds, and audience watch endpoints.
  8. **Empirical Verification**:
     - Created test suite `tests/critical-player-authentication-remediation.test.ts` covering Mandatory Security Tests A through H and Three-Path functional flows.
     - All 21 test suites (342 tests) passing, `npx tsc --noEmit` passing with 0 errors, `npm run lint` passing with 0 warnings, and Next.js production build passing with 0 errors.
- **Reason**:
  - The previous login endpoint allowed impersonation of any player on the public leaderboard simply by submitting their callsign. Cryptographic Supabase Auth OTP eliminates account hijacking while preserving a frictionless, passwordless 10-second onboarding experience.
- **Alternatives Evaluated**:
  - Traditional passwords with complex requirements (rejected: causes high friction outdoors on mobile devices).
  - Web3 / wallet login (rejected: overly complex for general Canton festival audiences).
  - Ephemeral anonymous tokens only (rejected: does not survive device loss or allow cross-device recovery for prize redemption).
- **Consequences**:
  - Rock-solid, cryptographically verified player identity root with seamless mobile OTP UX, safe legacy player preservation, and complete elimination of callsign impersonation vulnerabilities.
- **Status**: **ACCEPTED**

---

## ADR-026: Canonical Canton Quests Volume 1 Production Game Data Restoration & Idempotent Seed Migration
- **Date**: 2026-08-14
- **Decision**:
  1. **Canonical Production World Restoration**:
     - Restored the canonical Volume 1 playable world for Canton, Ohio into Supabase production tables via idempotent migration `supabase/migrations/20260814020000_restore_canton_volume1_production_seed.sql`.
     - Seeded records:
       - 1 City: Canton, Ohio (`canton-oh`, `a0000001-0000-4000-8000-000000000001`)
       - 9 Launch Locations: Centennial Plaza, McKinley National Memorial, 4th St Mural, Aura Craft Coffee, Arcade Vault, Palace Theatre, Hall of Fame City Marker, Onesto Entrance, and Frankenstein Monument.
       - 1 Event: Canton Quests: Volume 1 - The Founder's Cipher (`canton-weekend-1`, `b0000001-0000-4000-8000-000000000001`, `status = 'active'`, `current_phase = 'day_1'`).
       - 15 Canonical Quests spanning the Three-Path architecture (`family`, `challenge`, `secret`, `cross_city`).
       - 3 Multi-Step Quest Steps for `secret-cipher-77` with SHA-256 hashed verification targets.
       - 5 Collectibles: Founder Token, Cipher Fragments 1-3, Palace Seal.
       - 2 Secret Codes: Game Master Opening Broadcast Code (`founder-token`), Courier Drop (`palace-seal`).
       - 1 NPC: The Courier (`4th Street Arts Corridor`).
       - 2 Business Partners: Aura Craft Coffee, Downtown Canton Arcade Vault.
       - 2 Event Prizes: Champion Trophy + $100 Local Pass, Year of Aura Coffee VIP Pass.
       - 1 Drawing Ledger Lock initialized to status `open` (`is_locked = false`).
  2. **Deterministic UUID Architecture**:
     - Replaced text-based IDs (`city-canton-oh`, `evt-canton-vol-1`, `qst-centennial-discovery`) with standard deterministic UUIDv4 literals in database tables to guarantee relational foreign key integrity across environments without schema type mismatches.
     - Updated `lib/quest-proof-secrets.server.json` to map both legacy slugs and deterministic UUIDs to target answer hashes.
  3. **Zero Demo Player Seeding**:
     - Completely omitted test/demo players (`ApexHunter_330`, `CantonRover`, `DowntownDecoder`) from production seeding to enforce that all production player accounts originate from the cryptographically verified Supabase Auth identity root (`auth.users`).
  4. **Frankenstein Monument Safety Integrity**:
     - Preserved all real-world safety restrictions for the West Lawn Cemetery quest: daylight visiting hours only, respectful cemetery conduct, no touching/disturbing memorials. Coordinates remain `NULL` pending human field verification.
  5. **Non-Destructive Idempotency**:
     - Uses `INSERT ... ON CONFLICT (...) DO UPDATE` / `DO NOTHING`. Contains zero `DROP`, `TRUNCATE`, or `DELETE` statements. Safe to run multiple times without corrupting production or future player data.
- **Reason**:
  - Production tables were empty (0 rows across all core tables), causing the live route `/events/canton-weekend-1` to display "Quest Not Found". This migration safely establishes the canonical game world with full relational and auth integrity.
- **Consequences**:
  - The application routes and game engine seamlessly load Volume 1 world data from Supabase; full end-to-end launch readiness is established.
- **Status**: **ACCEPTED**

---

## ADR-027: Production Schema Catch-Up & Canonical Volume 1 Restoration Consolidated Migration
- **Date**: 2026-08-14
- **Decision**:
  1. **Single Production-Safe Catch-Up SQL**:
     - Authored `supabase/migrations/20260814030000_production_schema_catchup_and_volume1_restore.sql` to reconcile a live Supabase production database sitting at Phase 3 schema with out-of-order execution of `20260814010000_critical_player_auth_remediation.sql`.
     - Consolidates unapplied DDL from Phase 4 Event Factory, Phase 5.1 Spectator Engine, Core Quest Rewards Backbone, Transparent Prize Drawing System, QR Campaign Attribution, and Three-Path Architecture.
  2. **Authoritative Security State**:
     - Guarantees that the hardened RLS policies (`auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role'`), `prevent_player_user_id_tampering` triggers, and partial unique index on `players(user_id)` from ADR-025 are established as the final, immutable security state.
  3. **Canonical Volume 1 Restoration**:
     - Includes complete, idempotent Volume 1 game world restoration (1 City, 9 Locations, 1 Event, 15 Quests, 3 Steps, 5 Collectibles, 2 Secret Codes, 1 NPC, 2 Partners, 2 Prizes, 1 Drawing Lock).
     - Enforces zero demo player accounts and daylight-only West Lawn Cemetery safety boundaries.
- **Reason**:
  - Direct database queries revealed that live production had Phase 3 columns on `events` and was missing Phase 4 through Three-Path schema additions, while critical auth remediation had been run early. Running historical migrations individually risked RLS policy rollbacks or missing prerequisite columns; this consolidated migration safely bridges the gap in a single run.
- **Alternatives Evaluated**:
  - Dumbing down restoration data to match Phase 3 (rejected: would break the active application code that queries modern columns).
  - Manually executing multiple historical scripts out of order (rejected: high risk of RLS downgrade or constraint collisions).
- **Consequences**:
  - The live Supabase database can be brought to full modern operational readiness in a single SQL Editor paste, with zero risk of schema drift or security regressions.
- **Status**: **ACCEPTED**

---

## ADR-028: Futuristic Game Moments & HUD Effects Engine
- **Date**: 2026-08-15
- **Decision**:
  1. Implement a centralized, typed, queue-based Game Moments Engine (`lib/game-effects.ts`, `components/game-effects/`) across Canton Quests to elevate the product from a standard web app into an immersive, cinematic, high-stakes urban game.
  2. The system provides 8 distinct cinematic game moments:
     - **Quest List City Scan** (`city-scan`): 700–1100ms viewport sweep with HUD radar grid, scanning laser line, and staggered quest card arrivals.
     - **Three Starting Paths Path Lock** (`path-lock`): Deep cinematic onboarding moment with path-specific energy and particle treatments (Family: warm gold compass/rings; Challenge: kinetic crimson impact streaks; Secret: cryptic violet glyph runes) confirming starting door while communicating that all city quests remain open on one leaderboard.
     - **Quest Completion XP Impact** (`quest-complete`): Server-authoritative verification badge, large animated +XP count-up, drawing ticket ledger confirmation, and chain unlock notices.
     - **Leaderboard Rank-Up** (`rank-up`): Real-time rank progression animation (#old -> #new) with tiered visual intensity (Normal, Top 10, Top 3 Podium, Rank #1 Apex).
     - **Achievement Unlock** (`achievement`): Shimmering metallic badge reveal, description, and rewards.
     - **Flash Drop / Live Quest Alert** (`flash-drop`): Emergency tactical broadcast alert with pulse perimeter and live quest interception actions.
     - **Chain Complete Takeover** (`chain-complete`): Milestone takeover celebrating multi-step puzzle completions.
     - **Finale / Prize Qualification Ceremony** (`finale-qualified`): Prestigious gold card reveal displaying verified drawing entries and SHA-256 ledger proof hash.
  3. Integrated a zero-dependency Procedural Web Audio Synthesizer (`lib/game-audio.ts`) generating dynamic futuristic sound effects (radar sweeps, sub-bass impacts, harmonic chords, fanfare synths) without requiring external audio assets, respecting browser autoplay restrictions and mute settings.
  4. Enforced strict mobile-first performance and accessibility safeguards:
     - Battery-friendly HTML5 Canvas 2D particle rendering that sleeps on idle and cleans up timers on unmount.
     - Full `prefers-reduced-motion` support eliminating aggressive flashes and shortening transition timings into clean semantic fades.
     - Touch targets $\ge 44\text{px}$, safe area inset preservation, non-blocking overlays with tap-to-dismiss and keyboard `Escape` support.
     - Priority queueing ensuring sequential multi-reward moments (Quest Complete $\rightarrow$ Rank Up $\rightarrow$ Achievement) play gracefully without overlapping deadlocks.
- **Reason**:
  - The core product vision mandates that Canton Quests must feel like an unfolding real-world city adventure game rather than a sterile SaaS check-in form. Centralizing HUD effects maintains visual consistency, prevents code bloat, and provides high-impact player delight.
- **Alternatives Evaluated**:
  - Scattering ad-hoc CSS animations and modals across individual pages (unmaintainable, visual drift).
  - Introducing heavy 3D frameworks like Three.js (excessive battery drain and load times on mobile cellular networks).
- **Consequences**:
  - All game moments are uniformly managed via `showGameMoment()` or `triggerQuestRewardSequence()`; all 24 test suites and 386 tests pass with 100% success.
- **Status**: **ACCEPTED**

---

## ADR-029: Official Public Launch Date Confirmation — September 11, 2026
- **Date**: 2026-08-16
- **Decision**:
  1. Confirm **Friday, September 11, 2026** as the official, canonical public launch kickoff date for *Canton Quests: Volume 1 — The Founder's Cipher* (Event Weekend: September 11–14, 2026; Start: `2026-09-11T18:00:00Z`, End: `2026-09-14T22:00:00Z`).
  2. The preliminary September 4–7 schedule is permanently superseded across all active documentation, database seed migrations, API routes, and client copy.
  3. Reconcile project readiness status: software/engineering code is complete and passing all automated test suites; physical field verification (QR signage placement, partner permissions, cemetery rules, and on-site staff drills) remains in progress and pending human confirmation prior to launch.
- **Reason**:
  - Provides necessary operational runway for physical field preparation, merchant partner coordination, physical prize acquisition, street team distribution, and on-site rehearsal while eliminating conflicting dates across documentation and code.
- **Alternatives Evaluated**:
  - Retaining September 4 launch without adequate field prep runway (rejected: high risk of physical on-site logistical failure).
- **Consequences**:
  - All active codebase references, UI copy, seeds, migrations, and launch countdowns adhere strictly to the canonical September 11, 2026 date.
- **Status**: **ACCEPTED**

---

### [ADR-030] 2026-08-18: Final Homepage Flow, Explicit Path Choice, and Standardized Section Presentation
- **Decision**:
  1. Standardize public starting path pairings:
     - **Family**: Arts District (yellow/gold `#f59e0b`, Downtown Arts & Centennial Plaza)
     - **Challenge**: Mother Goose Land (red `#ef4444`, Mother Goose Land & Skate Corridor)
     - **Secret**: Monument Park (purple `#a855f7`, Monument Park & Historic Ciphers)
     Preserve all authentic Canton geography, landmarks, and quest locations without inventing fictitious layout.
  2. Require explicit path selection for normal homepage visitors:
     - Normal visitors arrive with `selectedStartingPath: null` and are not silently defaulted to Family.
     - Signup/onboarding form remains hidden until a path card is explicitly clicked.
     - Path Lock cinematic effect triggers on selection and confirms: "Starting Path Confirmed • All Canton Quests Remain Open on One Leaderboard."
  3. Pre-resolved path attribution for QR visitors:
     - Visitors arriving via campaign QR codes or path URLs (`/start/[path]`, `/go/[slug]`) bypass redundant path choice and enter onboarding directly for their attributed path.
  4. Intentional pre-launch UI states:
     - Zero active quests renders "GRID LOCKED • MISSIONS ACTIVATE SEPTEMBER 11, 2026".
     - Zero leaderboard scores renders "PRE-SEASON • LEADERBOARD ACTIVATES SEPTEMBER 11, 2026".
  5. Streamline homepage information hierarchy:
     - HERO → SHORT HOW IT WORKS (PICK, GO, PROVE, SCORE) → CHOOSE YOUR STARTING PATH → PATH-SPECIFIC ONBOARDING → REAL CANTON LOCATIONS → ONE STRONG FINAL CTA.
- **Reason**:
  - Eliminates silent defaulting to Family path, establishes clear visual hierarchy, reduces CTA clutter, and ensures seamless launch transition on September 11, 2026.

---

### [ADR-031] 2026-08-20: Authenticated Player Command Center and Player ID Card Persistence
- **Decision**:
  1. Preserve `/profile` as the canonical authenticated Player Command Center route after email confirmation, OTP login, and onboarding.
  2. Store Player ID Card personalization on `public.players`: avatar preset key, custom profile image storage path, crop zoom/x/y, profile visibility, player image visibility, and ordered featured BADGE slugs.
  3. Store custom player photos in a private Supabase Storage bucket named `player-profile-images`, scoped by authenticated player ownership, with server-mediated upload and image-only validation.
  4. Keep internal achievement table names for migration safety, while all player-facing profile UI labels the system as `BADGES`.
  5. Compute XP, city rank, completed quests, and prize entries from the existing authoritative score, leaderboard, submission, and drawing-entry systems instead of creating new counters.
- **Reason**:
  - Authenticated players need to land in a personalized Canton Quests command terminal after verification, with durable player card settings and strict image privacy.
- **Alternatives Evaluated**:
  - Creating a duplicate `/dashboard` route (rejected: `/profile` already exists as the player identity surface).
  - Baking player data into generated card images (rejected: less accessible, harder to update, and worse for privacy controls).
  - Public profile-image storage by default (rejected: private image visibility must be enforceable).
- **Consequences**:
  - `/profile` becomes the primary authenticated destination. Public homepage and QR walk-up discovery remain unchanged.
  - Featured BADGES are capped to the visible card slots and must be earned before selection.
  - Profile-image access requires owner authorization unless a future public profile surface explicitly applies the stored public visibility flags.
- **Status**: **ACCEPTED**
- **Status**: **ACCEPTED**

---

### [ADR-031] 2026-08-18: Master Visual Asset Package Integration & High-Performance Media Pipeline
- **Decision**:
  1. **Canonical Asset Matrix & Central Registry**:
     - Integrated all 22 cinematic asset package files into `public/canton-quests/` and strongly typed in `lib/marketing-assets.ts` under `cqImages`.
     - Created master manifest `docs/visual-assets-manifest.md` documenting every asset's source, role, component, and responsive dimensions.
  2. **Core Architectural Preservations**:
     - Preserved single citywide competition, 1 individual leaderboard, 3 starting paths (`Family`, `Challenge`, `Secret`), and 100% open quest access across Canton.
     - Preserved authentic real-world geography (Palace Theatre, Mother Goose Land / Willie, Football Heritage, McKinley Monument, West Lawn Frankenstein monument).
     - Rendered all scores, titles, XP, timers, and badges cleanly as accessible HTML layered over art (zero baked-in fake text/numbers).
  3. **High-Performance Video Pipeline**:
     - Extracted high-resolution poster frame `public/canton-quests/cq-briefing-poster.jpg` (1080p).
     - Transcoded raw 332MB promotional briefing video to web-streamable faststart MP4 `public/canton-quests/cq-briefing-transmission.mp4` (44.4MB, H.264/AAC, 1080p).
     - Integrated responsive `BriefingVideoModal` component with interactive hero triggers, accessible keyboard controls, and user audio toggle.
  4. **Thematic Surface & Card Skinning**:
     - `ThreePathSelector.tsx`: Integrated `familydoor.png`, `challengedoor.png`, `secretdoor.png` portals into path selection cards with dynamic glow accents.
     - `QuestCard.tsx`: Integrated upper photo window with real landmark art (`getQuestImage`), rarity tags (`COMMON`, `RARE`, `EPIC`, `LEGENDARY`), flash drop badges, and distinct frame treatments (`card_available.png`, `card_locked.png`, `card_complete.png`, `card_poster.png`).
     - Pre-launch & Standby Surfaces: Wired `Quest_board.png`, `leaderboard.png`, and `game_master_transmission.png` into pre-launch HUD banners with accessible HTML status copy.
     - Player Profile & Drawing Ledger: Wired `player_profile.png`, `quest_achievement_badges.png`, and `prize_vault.png` into profile HUD cards and transparent drawing ledger pages.
     - Cinematic Footer: Wired `footer_endoftrans.png` ambient gold backdrop and brand emblem lockup.
  5. **Transparent Prize Math & Non-Gamer XP Copy**:
     - Standardized prize drawing copy: "EVERY COMPLETED QUEST = ONE DRAWING ENTRY" (1 quest = 1 entry, 5 quests = 5 entries, 10 quests = 10 entries).
     - Standardized XP copy: "XP means Experience Points. You earn XP when verified quests are completed. XP is your score in Canton Quests. The more XP you earn, the higher you climb on the citywide leaderboard."
- **Reason**:
  - Establishes a cohesive AAA game atmosphere, eliminates video streaming stutter on mobile networks, and enforces clear, transparent player expectations for launch on September 11, 2026.
- **Status**: **ACCEPTED**

---

### [ADR-032] 2026-08-18: Pre-Launch State Architecture, Static Hash Module & Production Error Sanitization
- **Decision**:
  1. **Intentional Pre-Launch State System**:
     - Introduced centralized pre-launch detection utility (`lib/launch-status.ts`) recognizing all canonical launch slugs (`canton-weekend-1`, `canton-launch-2026`, `canton-vol-1`, `canton-volume-1`, `canton-quests-vol-1`, `canton-founder-cipher`, `the-founders-cipher`, etc.) against the canonical public launch timestamp: **September 11, 2026 at 18:00 UTC**.
     - Replaced misleading "Quest Not Found" / 404 errors on pre-launch routes with high-contrast, tactical `MISSION GRID OFFLINE` HUD states featuring `cqImages.questBoardBg` artwork, clear activation messaging, and CTAs to explore the city hub, rules, and pre-season leaderboard.
     - Preserved true 404 behavior for arbitrary non-launch slugs (e.g. `invalid-random-1234`).
  2. **Static Server Target Hashes Module (`lib/quest-proof-secrets.ts`)**:
     - Eliminated dynamic `eval('require')(`${process.cwd()}/lib/quest-proof-secrets.server.json`)` calls that caused runtime module resolution failures (`Cannot find module '/var/task/lib/...'`) inside Vercel serverless function bundles.
     - Replaced dynamic filesystem reads with a pure TypeScript statically bundled module (`lib/quest-proof-secrets.ts`) with optional `process.env.QUEST_PROOF_SECRETS_OVERRIDE_JSON` support, guaranteeing 100% server reliability without file I/O.
  3. **Strict Error Boundary & Production Sanitization**:
     - Updated drawing API (`app/api/game/events/[slug]/drawing/route.ts`) and drawing frontend (`app/events/[slug]/drawing/page.tsx`) with strict safe boundaries.
     - Before launch date: renders `PRIZE DRAWING SYSTEM STANDBY` detailing the 1 quest = 1 entry math, Sunday evening drawing, and deterministic algorithm.
     - On unexpected server failure: renders safe generic `SYSTEM TEMPORARILY UNAVAILABLE` with retry action, completely eliminating exposure of stack traces, `/var/task` paths, require chains, or internal secrets filenames.
- **Reason**:
  - Eliminates jarring pre-launch errors, secures internal server diagnostics, and prevents missing-module runtime crashes in production serverless environments.
- **Status**: **ACCEPTED**

---

### [ADR-033] 2026-08-20: Scanner-Safe Email Confirmation Architecture & TokenHash Flow
- **Decision**:
  1. **Prefetch & Scanner Resistance via Deliberate Action**:
     - Standardized on the Supabase `TokenHash` + `verifyOtp` confirmation pattern.
     - Email verification links point to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}` rather than direct GET redemption endpoints (`/auth/v1/verify`), preventing email security scanners (e.g. Microsoft Defender, Google Workspace prefetcher, antivirus scanners) from consuming one-time OTP links on initial GET requests.
     - `GET /auth/confirm` and `GET /api/auth/confirm` ONLY render the user interface and forward parameters; they **never** call `verifyOtp` or consume the token.
     - Verification is strictly executed only when the human player deliberately clicks the `CONFIRM & ENTER CANTON QUESTS` action button via `POST /api/auth/confirm`.
  2. **Canonical Production URLs & Allowed Redirect Domains**:
     - Configured canonical production origin to `https://divinedesigndestinations.com`.
     - Implemented strict open redirect validation (`sanitizeNextPath`) to reject arbitrary external schemes (`http://`, `https://`, `//`, `javascript:`) and restrict post-verification routing to valid internal application routes.
  3. **Player Identity & PostgreSQL UUID Compatibility**:
     - Upon successful deliberate token verification, `resolveOrCreatePlayerForAuthUser` claims or creates the player's account and provisions the player profile using valid UUIDs.
     - Stored session tokens in secure client storage (`canton_quests_current_player`, `canton_auth_token`), executed transition game moments, and routed players directly to their chosen starting questline.
- **Reason**:
  - Resolves email scanner link expiration bugs, eliminates production auth redirect drops, protects against open redirect vulnerabilities, and guarantees seamless onboarding for outdoor mobile players in Canton.
- **Status**: **ACCEPTED**

---

### [ADR-034] 2026-08-20: Full Server-Authoritative Integration of Futuristic Game Moments & HUD Effects Engine
- **Decision**:
  1. **Server-Authoritative Reward Delta Pipeline**:
     - Extended `SubmitProofResult` in `lib/types.ts` to return `oldRank`, `newRank`, and `newAchievements` alongside `awardedPoints` and `drawingEntriesAwarded`.
     - Wired real rank delta computation in both `lib/game-engine.ts` (`submitQuestProof`) and `lib/supabase-db.ts` (`submitQuestProofDB`), measuring leaderboard standings immediately prior to and after ledger insertion.
     - Wired dynamic achievement unlock evaluation returning newly earned achievements upon verified submission.
     - Updated `triggerQuestRewardSequence` in `app/events/[slug]/quests/[questId]/page.tsx` to consume authoritative server values, eliminating fallback defaulting to unearned rewards.
  2. **Active Live Flash Drop Detection**:
     - Wired `showGameMoment({ type: 'flash-drop', ... })` in `app/quests/page.tsx`, `app/events/[slug]/page.tsx`, and quest details page with session storage deduplication (`cq_flash_seen_${questId}`) and interactive badge inspection.
  3. **Server-Authoritative Player-Specific Finale Qualification Integration**:
     - Introduced `getAuthenticatedPlayerDrawingQualification` / `getAuthenticatedPlayerDrawingQualificationDB` and attached `authenticatedPlayerQualification` to `/api/game/events/[slug]/drawing` responses for authenticated requests.
     - Keyed qualification strictly to the authenticated player's unique identity (`player.id`) and `publicParticipantId`, resolving their exact verified drawing entry count and locked ticket range.
     - Updated `app/events/[slug]/drawing/page.tsx` to consume server-resolved `data.authenticatedPlayerQualification` directly, completely eliminating client-side `displayName` or partial-ID substring guessing against public projections.
     - Guaranteed duplicate display names or stale local sessions cannot misattribute another player's tickets or qualification ceremony.
  4. **Smooth Onboarding & Path Lock Transitions**:
     - Updated `components/FastPlayerOnboardForm.tsx` and `app/auth/confirm/page.tsx` to trigger navigation via the `onFinished` callback of the `path-lock` moment with fallback timers, ensuring visual energy sequences are never prematurely cut short.
  5. **Overlay Usability & Tap-Anywhere Dismissal**:
     - Added backdrop click dismissal on root container `GameMomentOverlay.tsx` while isolating header and interactive controls via `stopPropagation`, aligning visual interaction with footer guidance ("TAP ANYWHERE OR PRESS ESC TO CONTINUE").
  6. **Strong Type Safety & Strict Test Coverage**:
     - Refactored `tests/cinematic-game-effects.test.ts` to eliminate `as any` type casting shortcuts, asserting strict typed narrowing (`RankUpMoment`, `QuestCompleteMoment`, `FinaleQualifiedMoment`, `FlashDropMoment`).
     - Added comprehensive end-to-end integration tests covering server-authoritative submission deltas, failed submissions awarding zero rewards, flash drop deduplication, and player-specific qualification ceremonies.
- **Reason**:
  - Elevates Canton Quests into a AAA real-world competitive game, ensuring all visual celebrations reflect real, immutable game state and deliver a fluid, glitch-free mobile experience for players on launch day.
- **Status**: **ACCEPTED**

---

### [ADR-035] 2026-08-21: Atomic Sequence Grouping & Deterministic FIFO Reward Flow in Game Moments Engine
- **Decision**:
  1. **Atomic Sequence Preservation via `sequenceId` and `sequenceIndex`**:
     - Added `sequenceId`, `sequenceIndex`, and `sequencePriority` to `BaseGameMoment`.
     - Implemented `GameMomentManager.compareMoments` to guarantee that all moments belonging to the same atomic sequence group (such as verified quest completion: `quest-complete` -> `rank-up` -> `achievement` -> `chain-complete`) are strictly executed in sequence order.
     - Prevented individual moment priorities (e.g. `rank-up` priority 90) from reordering or overtaking `quest-complete` (XP impact) when enqueued while an existing overlay (e.g. City Scan, Flash Drop, Finale) is actively displayed.
  2. **Unified Batch Enqueue via `triggerSequence`**:
     - Introduced `triggerSequence` / `triggerGameMomentSequence` in `lib/game-effects.ts`.
     - Refactored `triggerQuestRewardSequence` to use `triggerSequence`, guaranteeing atomic FIFO sequencing across both idle and active overlay states.
  3. **Strict Integration Testing**:
     - Added integration tests verifying that `triggerQuestRewardSequence` called during an active City Scan overlay preserves the exact sequence `[quest-complete, rank-up, achievement, chain-complete]` without priority inversion upon dismissal.
- **Reason**:
  - Ensures reward presentation is strictly deterministic, logical, and server-authoritative, guaranteeing players always see the XP reward for a completed quest before experiencing rank ascension or achievement awards.
- **Status**: **ACCEPTED**

---

### [ADR-036] 2026-08-21: Native React SectorMap Conversion, Tactical CARTO Radar Grid & Spectator Telemetry HUD
- **Decision**:
  1. **Native Component Architecture (`components/SectorMap.tsx`, `components/SectorMapWrapper.tsx`)**:
     - Converted the standalone HTML/JS prototype (`public/canton-quests/canton-quests-real-map.html`) into an idiomatic, typed React component (`SectorMap.tsx`) and Next.js dynamic client wrapper (`SectorMapWrapper.tsx`).
     - Replaced vanilla DOM manipulation with React state and lifecycle hooks (`useState`, `useEffect`, `useCallback`) for the live activity ticker, player/quest counters, HUD 24-hr clock, and zone marker pulses.
  2. **Configurable Canton Sector Zones**:
     - Maintained `SECTOR_ZONES` as a typed configuration array at the top of `SectorMap.tsx` defining exact real-world GPS coordinates, colors, and radii in meters:
       - McKinley / West Lawn (`#b46bff`, lat: `40.8070`, lng: `-81.3936`, radius: `520m`)
       - Downtown / Arts District (`#ffcf3f`, lat: `40.8000`, lng: `-81.3758`, radius: `560m`)
       - South Side / 9th St (`#ff3b3b`, lat: `40.7880`, lng: `-81.3805`, radius: `480m`)
  3. **Visual Aesthetics & Tactical HUD Styling**:
     - Preserved exact tactical HUD aesthetics: CARTO dark basemap tiles, 360-degree rotating radar sweep overlay, scanline overlay, zone glow circles, interactive pulsing pin animations, 3-stat summary bar, and district color legends.
  4. **Google Fonts & Typography Standardization**:
     - Updated `@import url(...)` in `app/globals.css` to load `Rajdhani` (`wght@400;500;600;700`) alongside `JetBrains Mono` and `Inter`/`Outfit`.
  5. **Clear Telemetry Extension Boundary & Watch Page Integration**:
     - Structured mock telemetry generation with clear comments documenting how to swap in Supabase Realtime or WebSocket telemetry channels.
     - Mounted `<SectorMapWrapper />` on `app/watch/page.tsx` within the public live spectator watch feed.
- **Reason**:
  - Provides a high-energy, real-world visual representation of the active Canton game grid on the live spectator watch airwaves with 0 server-side rendering friction.
- **Status**: **ACCEPTED**

---

### [ADR-037] 2026-08-21: Server-Authoritative Spectator Telemetry & Deterministic Moment Lifecycle
- **Decision**:
  1. **Strict Server-Authoritative Spectator Telemetry in SectorMap**:
     - Refactored `components/SectorMap.tsx` to consume real `feed: PublicGameFeedItem[]`, `activeSpectatorCount`, and `districts` from server-side APIs on the public `/watch` page.
     - Completely removed hardcoded starting counts (`initialPlayers = 142`, `initialQuests = 318`) and removed interval-based random mock telemetry generators from public production paths.
     - Formatted real sanitized public dispatches for the activity ticker without synthesizing unverified XP rewards, displaying clean standby states when awaiting live field operations.
     - Updated 3-stat summary bar to display authoritative metrics: Monitored Sectors, Active Observers, and Verified Public Dispatches.
  2. **Deterministic Game Moment Lifecycle & `skipAll` Completion Handlers**:
     - Moved `onFinished?: () => void;` to `BaseGameMoment`, enabling completion callbacks across all moment types.
     - Updated `GameMomentManager.skipAll()` and `dismissCurrent()` to invoke `onFinished` safely on the active moment prior to queue clearing, ensuring all route transitions execute reliably.
  3. **Navigation Race Condition & Duplicate Route Push Protection**:
     - Added `hasNavigated` guards and cancelable fallback timer handles to `components/FastPlayerOnboardForm.tsx` and `app/auth/confirm/page.tsx`.
     - Guaranteed that normal auto-dismissal, explicit user skips, and safety timeout fallbacks cannot trigger duplicate route pushes or navigation side-effects.
- **Reason**:
  - Eliminates false public game state, preserves strict server-authoritative reward integrity, and guarantees glitch-free mobile navigation across all onboarding and game moment flows.
- **Status**: **ACCEPTED**

---

### [ADR-038] 2026-08-21: Authoritative Chain Completion Integrity & SectorMap Reduced-Motion Accessibility
- **Decision**:
  1. **Authoritative Quest Chain Completion vs. Intermediate Progression**:
     - Updated quest submission resolution in `app/events/[slug]/quests/[questId]/page.tsx` so that `isChainComplete: true` is strictly passed only when a quest chain is actually finished:
       - Multi-step quests (`verificationType === 'multi_step'` or multi-step arrays) whose steps are all fully verified.
       - Terminal leaf quests in a prerequisite chain (`prerequisiteQuestId` present, with no downstream dependent quests).
     - Intermediate quest progression (where completing quest $A$ unlocks quest $B$) displays `unlockedQuestTitle` ("🔓 UNLOCKED IN CHAIN: <Title>") in the `quest-complete` moment without triggering a false `QUEST CHAIN COMPLETE` takeover.
  2. **SectorMap HUD Reduced-Motion Accessibility**:
     - Added `@media (prefers-reduced-motion: reduce)` rules in `components/SectorMap.tsx` to disable the continuous radar sweep (`display: none`), status dot blink (`animation: none`), quest pin pulse rings (`animation: none`), and ticker item slide entrance.
     - Preserves full readability and semantic data access without battery drain or vestibular discomfort.
  3. **Verification**:
     - Added unit tests in `tests/cinematic-game-effects.test.ts` asserting intermediate chain progression does not queue false chain completions, terminal and multi-step chains fire chain completions, and SectorMap handles reduced motion.
- **Reason**:
  - Enforces authoritative truth in game moment celebrations (never presenting false milestone completion) and guarantees complete reduced-motion compliance across all HUD and spectator interfaces.
- **Status**: **ACCEPTED**

---

### [ADR-039] 2026-08-21: Persistent Password Accounts, Secure Session Refresh, Scanner-Safe Recovery, and Explicit Logout Architecture
- **Decision**:
  1. **Canonical Password Account Model**:
     - Converted Canton Quests player authentication to standard password accounts managed authoritatively via Supabase Auth (`auth.users`).
     - **New Player Signup**: Collects callsign + email + password (min 6 chars) + confirm password + starting path (`FastPlayerOnboardForm`, `/api/auth/register`). Passwords belong strictly to Supabase Auth and are never written to public tables or custom database columns. Sends 1-time scanner-safe confirmation link.
     - **Returning Player Login**: Requires **EMAIL + PASSWORD ONLY** (`app/auth/login/page.tsx`, `components/FastPlayerOnboardForm.tsx`, `/api/auth/login`). Callsign is not requested or required for login.
     - **Post-Login Routing**: Resolves authenticated Supabase user -> `players.user_id = auth.users.id` -> linked player row, restoring callsign, avatar/photo, starting path, XP, badges, and drawing entries, routing directly to the Player Command Center (`/profile`).
  2. **Session Persistence Until Explicit Logout**:
     - Configured persistent session cookies (`canton_player_id`, `sb-access-token`, `sb-refresh-token` with 30-day `maxAge`) and localStorage credentials (`canton_auth_token`, `canton_quests_current_player`, `canton_player_profile`).
     - Page refresh, in-app navigation, and browser close/reopen preserve authenticated player state. No automatic logout timers or ephemeral session-only cookie terminations.
     - Normal player-controlled session termination is explicit **LOG OUT**, which revokes Supabase session state, clears cookies (`Max-Age=0`), and purges browser persistence.
  3. **Safe Legacy Player Account Transition**:
     - Existing pre-password players retain 100% of their historical XP, badges, starting path, and drawing tickets.
     - Pre-password players set their password via **FORGOT PASSWORD** (`/auth/login` -> `/auth/reset-password`). Verification securely attaches their password to their existing `auth.users` identity without creating duplicate auth records or duplicate player rows.
  4. **Scanner-Safe Account Recovery**:
     - Forgot Password flow dispatches a Supabase recovery email with `type=recovery` and token hash pointing to scanner-safe `/auth/confirm`.
     - Initial `GET /auth/confirm` and `GET /api/auth/confirm` do NOT consume recovery tokens or trigger actions.
     - Human click deliberately executes `POST /api/auth/confirm`, verifies `type=recovery`, opens `/auth/reset-password`, validates new password + confirmation, calls Supabase `updateUser`, and returns the player to their Command Center (`/profile`).
  5. **Authenticated Navigation & Homepage States**:
     - Logged-in players receive prominent recognition on `/` ("WELCOME BACK, <CALLSIGN>", with 1-click CTA to Command Center) and in primary navigation (`CinematicNav`, `Header`) displaying player avatar, callsign, and explicit LOG OUT button.
- **Reason**:
  - Provides a frictionless, modern player account experience for returning festival explorers while eliminating email link fatigue on return visits, guaranteeing durable session survival across browser closes outdoors on mobile devices, and protecting against token pre-consumption by corporate email scanner bots.
- **Status**: **ACCEPTED**

---

### [ADR-040] 2026-08-21: Host-Only Cookie Architecture, Dual-State Contract Integrity, and Auth Diagnostic Telemetry
- **Decision**:
  1. **Host-Only Authentication Cookies (RFC 6265 Compliance)**:
     - Removed hardcoded `Domain=.divinedesigndestinations.com` from `persistentCookieOptions` and `expiredCookieOptions` in `lib/supabase-auth.ts`.
     - Cookies are emitted as standard host-only cookies, eliminating browser rejection due to domain mismatches across production hosts (`www.divinedesigndestinations.com`, `canton-quests.vercel.app`, preview deployments `*.vercel.app`, and local test environments).
     - `clearAuthCookies` expires both host-only cookies and legacy domain cookies (`.divinedesigndestinations.com`) to purge any old cookies from players' browsers.
  2. **Auth Route Contract Clarity & Diagnostic Logging**:
     - `GET /api/auth/me` returns HTTP 200 with `{ isAuthenticated: false, player: null, achievements: [] }` when unauthenticated, and `{ isAuthenticated: true, player: {...}, ... }` when authenticated. Added `export const dynamic = 'force-dynamic'`.
     - `GET /api/player/command-center` strictly returns HTTP 401 when unauthenticated and HTTP 200 with complete command center state when authenticated. Automatically sets refreshed tokens if background session rotation occurred.
     - Added safe `logAuthDiagnostic` helper across `/api/auth/login`, `/api/auth/me`, `/api/player/command-center`, and `resolveAuthenticatedSession` logging user presence, user IDs, and cookie presence without exposing secrets or tokens.
  3. **Verification**:
     - Added `tests/production-auth-cookie-jar-reproduction.test.ts` testing complete cURL-style cookie jar flow across multiple hostnames (`www.divinedesigndestinations.com`, `canton-quests.vercel.app`, `*.vercel.app`, `localhost:3000`).
- **Reason**:
  - Browser cookie engines (RFC 6265) reject cookies whose Domain attribute does not domain-match the request host (e.g. `.divinedesigndestinations.com` on `vercel.app`). Host-only cookies provide universal browser acceptance, tighter origin isolation, and complete cross-deployment reliability.
- **Status**: **ACCEPTED**

---

### [ADR-041] 2026-08-21: Player Card Coordinate System Calibration & Dynamic Single-Line Sizing Overlay
- **Decision**:
  1. **Guide-Calibrated Coordinate Architecture (`lib/player-card-layout.ts`)**:
     - Extracted exact mathematical bounding boxes from `public/canton-quests/player_card_guide.png` (1024 x 1536 px, 2:3 aspect ratio).
     - Centralized all 12 field coordinates in `PLAYER_CARD_LAYOUT` to ensure single source of truth across components and CSS.
     - Fixed master artwork `public/canton-quests/player_card.png` remains untouched as background; dynamic values render as absolute percentage overlays inside their intended golden box cutouts without occluding pre-printed labels.
  2. **Single-Line Callsign Guarantee & Dynamic Scaling**:
     - Enforced `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` on `.cq-card-callsign` with length-aware font scaling classes (`cq-callsign-lg`, `cq-callsign-md`, `cq-callsign-sm`, `cq-callsign-xs`).
     - Real production stress case `dustinsigley126` (15 chars) renders cleanly on one single line inside the Callsign header bracket.
  3. **District & Metadata Alignment**:
     - Starting District positioned at `top: 34.51%, height: 5.14%` (under the printed label `"STARTING DISTRICT"`), scaling dynamically for long values like `"9th St Skate Park area"` and `"West Lawn Cemetery / McKinley area"`.
     - Numeric stat boxes (`TOTAL XP`, `QUESTS COMPLETE`, `PRIZE ENTRIES`, `CITY RANK`) mapped to their exact icon-aligned positions (`top: 52.28%`) with flex centering.
     - 6 individual circular badge slots mapped to their respective artwork rings (`top: 60.81%`), rendering transparent overlays that preserve empty rings when fewer than 6 badges are earned.
  4. **Responsive Container Query Invariance**:
     - Added `container-type: inline-size` on `.cq-player-card-wrap` using container query units (`cqi`). Card overlay positions, font proportions, and layout geometry scale with 100% mathematical fidelity across desktop, 430px, 390px, 375px, and 320px screens.
  5. **Verification**:
     - Added `tests/player-card-guide-calibration.test.ts` testing coordinate fidelity, callsign scaling, district scaling, stat centering, and 0-6 badge variations.
- **Reason**:
  - The live player card was using coarse approximate CSS coordinates and multi-line word wrapping that caused callsigns and district names to cover printed card art labels. Guide calibration guarantees pixel-accurate alignment across all mobile and desktop devices.
- **Status**: **ACCEPTED**

---

### [ADR-042] 2026-08-21: Tactical & Cinematic Event-Driven Sound Architecture

- **Decision**:
  1. **Centralized CQ Sound Architecture (`lib/audio/`)**:
     - Created a single reusable sound map (`lib/audio/cq-sound-map.ts`) and sound manager (`lib/audio/cq-sound-manager.ts`) replacing scattered procedural blips with 22 custom, grounded, cinematic, and tactical audio assets in `/public/audio/cq/`.
     - Defined 22 typed sound events spanning 6 key categories: UI (`ui_click`, `ui_confirm`, `ui_back`, `ui_error`, `ui_locked`), Quest (`quest_select`, `quest_start`, `quest_complete`, `chain_unlock`, `secret_reveal`), Player (`badge_unlock`, `rank_up`, `xp_gain`), Event (`flash_drop`, `transmission`, `finale_qualified`), Path (`path_family`, `path_challenge`, `path_secret`), and Map/HUD (`scan`, `lock_on`, `node_ping`).
     - Swapping or upgrading sound assets in the future requires editing only `/public/audio/cq/` without altering component logic.
  2. **Spam Debounce, Concurrency Limiting, & Priority Ducking**:
     - Configured per-event cooldown timers (e.g. 45ms for UI clicks, 500ms for major rewards) preventing 10x overlapping spam from rapid taps.
     - Enforced audio concurrency caps (max 2 active instances per asset).
     - Implemented dynamic priority ducking: major reward stingers (priority >= 75: `finale_qualified`, `rank_up`, `badge_unlock`, `quest_complete`) suppress/duck low-priority UI clicks during playback to guarantee crisp, uncluttered sonic clarity.
  3. **Intentional Reward Sequencing**:
     - Implemented `playSequence` with deterministic stagger delays, ensuring multi-event completions (quest complete -> rank up -> badge unlock -> chain unlock) sequence with cinematic intentionality rather than firing simultaneously.
  4. **Global User Control, Mobile Autoplay & Persistence**:
     - Created compact, accessible `SoundToggleControl` components integrated across the HUD and primary navigation bars (`CinematicNav`, `Header`, `GameMomentOverlay`).
     - Persists sound preferences (`cq_sound_enabled`, `cq_sound_volume`) in `localStorage` without touching auth credentials.
     - Implemented passive one-time gesture unlock on `pointerdown`/`touchstart`/`keydown` ensuring reliable playback on iOS Safari and Android Chrome without unhandled promise rejections.
  5. **Procedural Audio Bridge**:
     - Retained procedural Web Audio synthesizer in `lib/game-audio.ts` for dynamic oscillator sweeps (radar pings, sub-bass impacts, fallback synthesis) while delegating high-stakes game moments to `cqSoundManager`.
- **Reason**:
  - The previous procedural audio was composed of simple synthetic beeps that felt arcade-like and did not match Canton Quests' premium, cinematic, real-world tactical identity. The new architecture provides grounded, impactful sound design with centralized asset management, spam protection, and mobile reliability.
- **Status**: **ACCEPTED**

---

### [ADR-043] 2026-08-21: Canonical Production Domain Migration to www.cantonquests.com

- **Decision**:
  1. **Canonical Production Origin (`https://www.cantonquests.com`)**:
     - Configured `https://www.cantonquests.com` as the canonical production origin across Next.js metadata (`metadataBase`, OpenGraph, Twitter cards), auth redirect resolver (`lib/supabase-auth.ts:getSiteUrl()`), QR campaigns (`lib/qr-campaigns.ts`, `lib/qr-flyer-generator.ts`), and game engine token generation (`lib/game-engine.ts`).
  2. **Host-Only Auth Cookie Invariance**:
     - Maintained host-only cookie emission (`Set-Cookie: sb-access-token=...; Path=/; HttpOnly; Secure; SameSite=Lax`) with no explicit Domain attribute, preventing cookie rejection across production domains, preview branches, and localhost.
     - Enhanced `clearAuthCookies()` to purge legacy cookies across all connected domains (`.divinedesigndestinations.com`, `.cantonquests.com`, `.cantonquests.vip`).
  3. **Safe Middleware Canonicalization (`middleware.ts`)**:
     - Redirects legacy production domains (`divinedesigndestinations.com`, `www.divinedesigndestinations.com`), the apex domain (`cantonquests.com`), and the Vercel alias (`canton-quests.vercel.app`) to `https://www.cantonquests.com` with HTTP 308 (preserving paths and query parameters).
     - Explicitly preserves direct serving without redirect for `cantonquests.vip`, `www.cantonquests.vip`, `localhost`, and Vercel preview deployments (`*.vercel.app`).
  4. **Email Verification & Scanner Safety**:
     - All verification/recovery links generate with `https://www.cantonquests.com` while allowing multi-domain redirect sanitization (`sanitizeRedirectUrl`) without open-redirect vulnerabilities.
- **Reason**:
  - Unifies brand identity under the official Canton Quests domain while maintaining seamless authentication, email verification, persistent sessions, and multi-domain flexibility across `.com` and `.vip`.
- **Status**: **ACCEPTED**

---

### [ADR-044] 2026-08-21: Permanent No-Tailwind Frontend Rule & Scoped Custom CSS Enforcement

- **Decision**:
  1. **Zero Tailwind Dependency & Utility Ban**:
     - Canton Quests does not use Tailwind CSS. Tailwind utility classes (`w-*`, `h-*`, `flex`, `grid`, `absolute`, `relative`, `inset-*`, `rounded-*`, `object-*`, `shrink-*`, `text-*`, `bg-*`, `border-*`, `ring-*`, `p-*`, `m-*`, `gap-*`, etc.) are prohibited unless explicitly defined in `app/globals.css`.
  2. **Scoped `.cq-*` Custom CSS Architecture**:
     - All visual styling is defined in `app/globals.css` with structured `.cq-*` class naming conventions or component-scoped `<style jsx>`.
  3. **Strict Image Sizing & Blowout Prevention**:
     - All `<img>` elements must include explicit `width` and `height` attributes and CSS sizing constraints (`.cq-*-img`, `max-width`, `object-fit`) to prevent high-resolution natural asset blowout.
  4. **Automated Static Safety Guardrails**:
     - Created static unit tests (`tests/no-tailwind-frontend-safety.test.ts`) that scan frontend components for undeclared Tailwind-style utility classes and fail if invalid utilities are introduced.
- **Reason**:
  - The Next.js architecture does not compile Tailwind CSS. Writing Tailwind utility classes creates silent no-op strings in the DOM, causing images to render at full natural dimensions (e.g. 1254px avatars) and breaking layout containers in production.
- **Status**: **ACCEPTED**

---

### [ADR-045] 2026-08-30: Challenge Sector Standalone Quest Cards Integration & Route Architecture

- **Decision**:
  1. **Standalone 2:3 Quest Cards Integration**:
     - Integrated the two new standalone mission cards alongside existing Challenge sector cards under `public/canton-quests/quests/challenge/`:
       - `01 — SKATE PARK`: `public/canton-quests/quests/challenge/skate_park.png` (9th Street Skate Park)
       - `02 — THE OPEN GROUND`: `public/canton-quests/quests/challenge/the_open_ground.png` (Large Field / Challenge Field)
       - `03 — THE TOWER`: `public/canton-quests/quests/challenge/silo.png` (Mother Goose Land Tower)
       - `04 — THE MURAL`: `public/canton-quests/quests/challenge/mother_mural.png` (Mother Goose Land Mural Wall)
       - `05 — WILLIE THE WHALE`: `public/canton-quests/quests/challenge/willie.png` (Willie the Whale)
     - Strongly typed all 5 card asset paths in `lib/marketing-assets.ts` (`cqImages.challengeSkatePark`, `cqImages.challengeOpenGround`, `cqImages.challengeTower`, `cqImages.challengeMural`, `cqImages.challengeWillie`).
  2. **Canonical 5-Mission Route Order & Data Alignment**:
     - Preserved the exact 5-mission route order (01 Skate Park -> 02 Open Ground -> 03 Tower -> 04 Mural -> 05 Willie).
     - Connected `SEED_LOCATIONS` (`loc-challenge-field`, `loc-challenge-tower`, `loc-mother-goose-land`, `loc-9th-street`) and `SEED_QUESTS` (`qst-9th-street-opening`, `qst-challenge-open-ground`, `qst-challenge-the-tower`, `qst-challenge-the-mural`, `qst-challenge-blue-signal`) with matching title, location, description, and 100 XP rewards.
     - Preserved all existing quest IDs, prerequisite chains (C1–C4), validation mechanics, and database relationships.
  3. **Full-Card Aspect Ratio Fidelity & No-Tailwind Custom CSS**:
     - Updated `getQuestImage()` to map quests by slug and location.
     - Updated quest detail page (`app/events/[slug]/quests/[questId]/page.tsx`) to detect standalone cards via `isStandaloneQuestCard()` and render them at authentic 2:3 aspect ratio with `object-contain`, preventing clipping or stretching on desktop and mobile.
     - Created scoped `.cq-challenge-cards-*` custom CSS in `app/globals.css` and integrated the 5-card sequence showcase into `components/landing/ChallengeLanding.tsx` adhering to Rule 21.
- **Reason**:
  - Provides a cohesive, high-fidelity visual presentation of the Challenge Sector physical route, ensuring every card displays its standalone artwork and metadata cleanly across all viewport sizes.
- **Status**: **ACCEPTED**

---

### [ADR-046] 2026-08-31: Founder's Cipher Phase 2 Engine Reconciliation & Manual District Decode Architecture

- **Decision**:
  1. **Four-State District Cipher Lifecycle**:
     - Standardized the district cipher lifecycle across both Supabase and local storage engine:
       - `0 fragments`: `locked`
       - `1–2 fragments`: `in_progress`
       - `3 fragments`: `ready_to_decode`
       - `Manual Sequence Verified`: `token_unlocked`
     - The third fragment collection transition sets district status strictly to `ready_to_decode` and **NEVER** automatically unlocks the district Sigil.
  2. **Authoritative Manual District Decode (`/api/game/cipher/decode`)**:
     - Introduced server-authoritative manual decode endpoint (`decodeDistrictCipherDB` / `decodeLocalCipherDistrict`) where players submit their 3-tile fragment sequence.
     - Enforces authenticated player session, event scoping, verification of 3 owned fragments, tile sequence checking against canonical district phrases, and idempotent Sigil unlocks.
     - Canonical district phrases:
       - **Family / Arts**: `"A NAME OUTLIVES THE MAN."` (`['A NAME', 'OUTLIVES', 'THE MAN']` -> Arts Sigil)
       - **Challenge**: `"THE WORLD GAVE A MONSTER HIS NAME."` (`['THE WORLD', 'GAVE A MONSTER', 'HIS NAME']` -> Challenge Sigil)
       - **Secret**: `"THE DEAD KEEP IT AT WEST LAWN."` (`['THE DEAD', 'KEEP IT', 'AT WEST LAWN']` -> Secret Sigil)
  3. **Unified Master Cipher Gate (3 Locks + 3 Decoded Sigils)**:
     - Gated Master Cipher submission (`lib/finale.ts:checkFinaleEligibility`, `lib/finale-db.ts`) behind the exact canonical rule: **3 Founder Locks** (`THE MARK`, `THE CODE`, `THE WORD`) **AND** **3 Decoded District Sigils**.
     - Completely removed legacy shortcuts (XP $\ge 750$, 5+ verified quests, locks-only bypass, GM wildcard auto-grant) from Master Cipher qualification logic.
  4. **Dynamic Commander Messaging & State Events**:
     - Registered path-aware Commander state messages for `FIRST_CIPHER_FRAGMENT_RECOVERED`, `DISTRICT_READY_TO_DECODE`, `DISTRICT_SIGIL_UNLOCKED`, `FOUNDER_LOCK_RECOVERED`, `ALL_THREE_LOCKS_RECOVERED`, `ALL_THREE_SIGILS_DECODED`, `MASTER_CIPHER_AVAILABLE`, `CIPHER_SOLVED`, and `MISSION_COMPLETE`.
  5. **Additive Migration Safety**:
     - Created additive migration `supabase/migrations/20260831120000_founders_cipher_phase2_manual_decode_reconciliation.sql` (Status: `PREPARED ONLY`, not applied remotely).
- **Reason**:
  - Restores player puzzle agency and enforces the approved Phase 1 Founder's Cipher game architecture, eliminating premature automated unlocks and rogue engine bypasses while preserving nonlinear 14-quest independence and the 1-entry-per-quest drawing promise.
- **Status**: **ACCEPTED**

---

### [ADR-047] 2026-08-31: Mission-Specific Live Radar Maps & Stark County Fair Live Map Architecture

- **Decision**:
  1. **Strict Mission Scoping for Live Radar Maps**:
     - Scoped the Canton Tactical Sector Map (`components/SectorMap.tsx` / `SectorMapWrapper.tsx`) strictly to the Founder's Cipher mission (`canton-launch-weekend` / `/events/[slug]`).
     - Embedded `SectorMapWrapper` inside the MAP tab on `/events/[slug]` alongside the node scanner `CantonMapWrapper`, providing downtown Canton sector radar rings (Downtown, McKinley, South Side) and real-time field dispatch telemetry directly within the Cipher mission hub.
  2. **Dedicated Stark County Fair Live Map (`components/FairLiveMap.tsx` & `FairLiveMapWrapper.tsx`)**:
     - Built a dedicated client-side Leaflet radar map centered on the Stark County Fairgrounds campus (`[40.8038, -81.3995]`, 305 Wertz Ave SW, Canton, OH) with zoom 16.2.
     - Configured 4 canonical fairground sector zones (`FAIR_SECTOR_ZONES`):
       - `grandstand`: Grandstand & Track Area (`40.8060, -81.3992`, 110m, `#ff3b3b`)
       - `midway`: Midway & Carnival Plaza (`40.8042, -81.3975`, 120m, `#ffcf3f`)
       - `exhibition`: Exhibition & Agri Pavilion (`40.8025, -81.4012`, 130m, `#00f0ff`)
       - `food_row`: South Gate & Food Row (`40.8014, -81.3988`, 110m, `#10b981`)
     - Implemented `resolveFairZoneId` parser for live Signal claims (`fair-core-01` to `fair-core-20`, daily bonuses, keywords).
     - Integrated live dispatches activity ticker with dynamic zone pulse animations, 24-hour Canton local HUD clock, live active agents/spectators count, and standalone feed polling (10-second interval).
  3. **Mission Isolation Across Spectator and Event Dashboards**:
     - Integrated `FairLiveMapWrapper` directly onto the Fair QR Hunt dashboard (`app/events/fair-qr-hunt/page.tsx`).
     - Updated spectator watch page (`app/watch/page.tsx`) to dynamically switch between `FairLiveMapWrapper` (when watching `fair-qr-hunt`) and `SectorMapWrapper` (when watching the Founder's Cipher mission or general operations).
  4. **Accessibility & No-Tailwind Custom CSS Compliance**:
     - Enforced `@media (prefers-reduced-motion: reduce)` overrides across all continuous animations (radar sweep, blinks, pulse rings) in both maps.
     - Used scoped custom styling (`.cq-fair-map-root`) with zero Tailwind classes, complying strictly with Rule 21.
- **Reason**:
  - The spectator and event surfaces previously showed downtown Canton districts for all events. Building a dedicated Stark County Fairgrounds radar map provides authentic, real-world fairground telemetry for the Fair QR Hunt while isolating the downtown cipher map strictly to the Founder's Cipher mission.
- **Status**: **ACCEPTED**

---

### [ADR-048] 2026-08-31: Authoritative Final Quest Number Verification Engine & Transparent Drawing Presentation

- **Decision**:
  1. **Rewrite Step 01 with Explicit Inputs & Plain English Definitions**:
     - Explicitly named the permanent Canton Quests number in full: `311420151417215192019`.
     - Explicitly displayed the 4-variable formula:
       `311420151417215192019 × totalPlayers × totalValidEntries × totalCompletedQuests = FinalQuestNumber`.
     - Defined all three Mission totals in plain English:
       - `totalPlayers`: Total qualified players who entered and participated in the Mission.
       - `totalValidEntries`: Total valid prize drawing tickets earned across all qualified players.
       - `totalCompletedQuests`: Total verified quest completions submitted across the Mission.
     - Prohibited and completely eliminated `totalFinishers` from the formula and verification surfaces.
  2. **Mount Prominent `FinalQuestVerifierPanel` Component**:
     - Built `components/drawing/FinalQuestVerifierPanel.tsx` directly beneath Step 01 on `/how-it-works`.
     - Supports live mission selection, displays real authoritative numbers from the drawing ledger, provides copy actions for the substituted equation and the Final Quest Number, and formats responsive monospaced displays.
  3. **Strict State Differentiation: Live vs Frozen Ledger**:
     - Active Missions: Display `CURRENT — NOT FINAL` with live telemetry indicator and explanatory note that numbers update in real-time until drawing ledger is locked upon Mission conclusion.
     - Closed/Locked Missions: Display `FINAL VERIFIED TOTALS` with immutable cryptographic SHA-256 snapshot hash and locked timestamp.
     - Immutable Historical Drawing Receipts: Loads historical receipts from published prizes if a drawing has completed, guaranteeing that any subsequent database activity never alters the numbers used in past drawings.
  4. **BigInt Arbitrary-Precision Calculation Engine**:
     - Created `lib/final-quest-verifier.ts` executing all multiplications using native JavaScript `BigInt` (`311420151417215192019n * BigInt(p) * BigInt(e) * BigInt(q)`), completely avoiding standard JavaScript floating-point truncation.
  5. **Mobile Responsiveness & Strict No-Tailwind Custom CSS**:
     - Responsive wrapping using `word-break: break-all;` on long 21+ digit numbers and BigInt products.
     - Pure scoped `.cq-verifier-*` and `.cq-drawing-step-01-*` styles in `app/globals.css` adhering strictly to Rule 21.
  6. **Zero Regression on Steps 02–07**:
     - Steps 02 through 07 remain intact with precise wording connecting Step 01 to Step 02.
- **Reason**:
  - Guarantees complete transparency and trust in Canton Quests' winner selection math. Any player, spectator, or auditor can stand on `/how-it-works` after a drawing, read every number Canton Quests used, multiply them independently, obtain the identical Final Quest Number, and trace through Steps 02–07 to independently verify the winning ticket.
- **Status**: **ACCEPTED**

---

### [ADR-049] 2026-09-01: Founder's Cipher Canonical 3-District Live Feed & Event-Scoped Spectator Architecture

- **Decision**:
  1. **Canonical 3-District Model for Founder's Cipher**:
     - Standardized the source of truth in `lib/spectator-districts.ts` (`FOUNDER_CIPHER_CANONICAL_DISTRICTS`) to exactly THREE player districts matching canonical player starting paths:
       - **Family**: `Family (Arts District)` (`id: 'dist-family'`, `path: 'family'`, landmark: `Centennial Plaza & Downtown Arts Corridor`)
       - **Challenge**: `Challenge (Mother Goose Land)` (`id: 'dist-challenge'`, `path: 'challenge'`, landmark: `Mother Goose Land & 9th St Skate Park`)
       - **Secret**: `Secret (Monument Park)` (`id: 'dist-secret'`, `path: 'secret'`, landmark: `McKinley National Memorial & Monument Park`)
  2. **Elimination of Legacy 4-District Drift & Filler Zones**:
     - Removed legacy `Central Market District` and `Hall of Fame Village Zone` from the spectator engine and UI.
     - Confirmed that West Lawn is strictly the post-master-cipher finale destination and is NEVER rendered as a player district or fourth bucket.
  3. **Authoritative Event Scoping**:
     - Implemented `isFounderCipherOperation` and `isFairOperation` in `lib/spectator-districts.ts` to scope district data strictly per Operation.
     - Founder's Cipher receives the 3 canonical districts.
     - Fair QR Hunt (`fair-qr-hunt`) retains its 4 fairground zones (`Grandstand & Track Area`, `Midway & Carnival Plaza`, `Exhibition & Agri Pavilion`, `South Gate & Food Row`).
     - Future or unknown Operations return empty district arrays (`[]`) so they never inherit Founder's Cipher paths accidentally.
  4. **Strict Activity Reconciled to `event_players.path`**:
     - Both in-memory (`lib/spectator-engine.ts`) and Supabase (`lib/spectator-db.ts:getDistrictActivityDB`) now query actual player path registrations (`event_players.path` / `players.selected_starting_path`), active quests per path, and public game feed dispatches.
     - Activity data is strictly partitioned: Family activity reads only Family players, Challenge reads only Challenge players, and Secret reads only Secret players (with West Lawn filtered out).
  5. **UI & Responsive Layout Optimization**:
     - Updated `components/spectator/DistrictActivityView.tsx` to render a balanced 3-column layout (`grid-cols-1 sm:grid-cols-3`) on desktop and 1 column on mobile, with path-themed accent borders and badges (Family: Amber, Challenge: Crimson, Secret: Purple).
     - Updated fallback default in `components/spectator/CommunityStatsBar.tsx` and `app/watch/page.tsx` from 4 to 3 active districts for Founder's Cipher.
- **Reason**:
  - The live feed was erroneously displaying 4 districts containing legacy/stale labels (`Central Market District`, `Hall of Fame Village Zone`). Replacing the hardcoded arrays across both client and server layers fixes the source of truth, aligns live spectator telemetry with canonical player paths (`family`, `challenge`, `secret`), and prevents future UI drift.
- **Status**: **ACCEPTED**

---

### [ADR-050] 2026-09-01: Founder's Cipher Production Gameplay Reconciliation (`canton-weekend-1`)

- **Decision**:
  1. **Schema Catchup & Dynamic Event Resolution**:
     - Safely applied `20260828120000_founders_cipher_district_fragments.sql` to establish `cipher_fragments`, `player_cipher_fragments`, and `player_district_cipher_progress` tables with RLS and indexes.
     - Refactored `20260831120000_founders_cipher_phase2_manual_decode_reconciliation.sql` to dynamically resolve `event_id` from `public.events WHERE slug = 'canton-weekend-1'` (replacing hardcoded UUIDs).
     - Ensured `requires_watcher_eligibility = false` in `finale_config` for Founder's Cipher so normal players are never blocked by unconfigured watcher checks.
     - Synchronized canonical 9 fragment definitions and updated `finale_config.final_answer_hash` to the verified SHA-256 of `FRANKENSTEIN` (`sha256:cb230b66b39057eab0e681e01c457544fce740e98d172cc7fd41e51803c9ea47`).
  2. **Canonical 14-Quest Production Sync & Legacy Preservation**:
     - Safely marked the 15 legacy quests (`e0000001-...-0001` through `0015`) and 4 legacy draft quests as `status = 'inactive'` with `legacy-` slug prefixes, preserving all existing historical foreign keys and score ledger references without deletion.
     - Synchronized the authoritative 14 canonical quests (`bell-cipher`, `canton-sign-capture`, `draft-lineup`, `kraken-wall`, `palace-stars`, `9th-street-opening`, `challenge-open-ground`, `challenge-the-tower`, `goose-land-cipher`, `willie-the-whale`, `mckinley-monument-year`, `eternal-flame`, `golden-mark-cipher`, `spring-water-shelter`) with stable UUIDs, authoritative SHA-256 target codes, accepted answer variants, and complete `reward_config` fragment/lock mappings.
     - Synchronized the 3 Founder Lock collectibles (`col-founder-mark`, `col-founder-code`, `col-founder-word`) and updated `Mother Goose Land` coordinates (`40.8055, -81.3866`) in `public.locations`.
  3. **Backend Proof & Review Hardening**:
     - Fixed `submitQuestProofDB` in `lib/supabase-db.ts` to automatically fall back to `quest.verificationType` when `params.proofType` is omitted, eliminating not-null submission constraint errors.
     - Hardened `reviewSubmissionDB` in `lib/supabase-db.ts` to query `quest_submissions` directly and resolve `quest` by `sub.quest_id` if foreign key expansion is omitted by the PostgREST schema cache.
  4. **Pre-Launch Integrity & Verification**:
     - Preserved the canonical public launch gate (September 11, 2026 at 18:00 UTC) with zero artificial bypasses for public traffic.
     - Executed a complete digital end-to-end verification simulation against the live Supabase instance validating quest completion $\rightarrow$ fragment granting $\rightarrow$ tile decoding $\rightarrow$ 3 district sigils $\rightarrow$ 3 Founder Locks $\rightarrow$ convergence authorization $\rightarrow$ `FRANKENSTEIN` solution $\rightarrow$ destination reveal.
- **Reason**:
  - Reconciles the Founder's Cipher production schema and canonical 14-quest roster against the live Supabase instance so the digital game spine (quest → fragment → district → Founder Lock → Master Cipher → destination reveal) is provably correct end-to-end before players ever touch it.
- **Status**: **ACCEPTED**

---

### [ADR-051] 2026-09-01: Founder's Cipher Phase 2B Launch Polish & Auto-Polling

- **Decision**:
  1. **Instruction Copy & Developer Placeholder Cleanup**:
     - Removed all developer/placeholder wording (`Puzzle pending — no answer is configured yet.`) from `challenge-the-tower`, `golden-mark-cipher`, and `spring-water-shelter` across `lib/seed-data.ts` and the live Supabase production database.
     - Implemented provisional, field-safe riddle copy that prompts observation without exposing unverified answers or dates in player-facing text.
     - Flagged `The Tower` (`1957`), `The Golden Mark` (`1805`), and `Spring Water Shelter` (`SPRING`) for mandatory on-site physical confirmation.
  2. **Pending Photo Submission Auto-Polling**:
     - Implemented a lightweight 10-second polling lifecycle in `app/events/[slug]/quests/[questId]/page.tsx` that activates ONLY while a player has a pending manual review submission.
     - Automatically terminates polling immediately upon status transition (`verified` or `retry_requested`) or component unmount, with in-flight request guards.
     - Upon approval, fires the full reward sequence (`triggerQuestRewardSequence`, entry token modal, Three Locks / Cipher Fragment reveals, Commander messages, and feedback update) exactly once.
  3. **GM Mobile Operations Polish**:
     - Enhanced `/gm/[slug]` Section 6 (Quest Operations) with photo proof image rendering, agent callsign display, and touch-friendly $\ge 44\text{px}$ action buttons with responsive layouts.
  4. **West Lawn Endgame Semantic Preservation**:
     - Preserved existing digital completion semantics upon solving `FRANKENSTEIN` while logging an explicit post-field verification decision gate regarding mandatory physical checkpoint vs. epilogue destination.
- **Reason**:
  - Ensures a seamless, bug-free, and polished field experience for real players and game masters on launch day.
- **Status**: **ACCEPTED**

---

### [ADR-052] 2026-09-01: Seeded Demo Roster Profile Photo Resolution & Safe Fallback

- **Decision**:
  1. **Seeded Demo Photo Resolution**:
     - Updated `resolveAvatarUrl` (and `hasValidAvatar` / `isProfileIdentityComplete`) in `lib/player-command-center.ts` to allow players with `acquisitionSource === 'seeded_demo'` and `avatarUrl` starting with `data:image/` to resolve their face image data URI directly.
     - Updated `getPlayerRosterDB` in `lib/supabase-db.ts` to select `avatar_url` and `acquisition_source` from the `players` table in Supabase and pass them into `resolveAvatarUrl`.
  2. **Strict Roster Image Resolution Hierarchy**:
     - 1. Real player's resolved custom profile image (`/api/player/${id}/avatar` when `avatarPresetKey === 'custom'` and `profileImagePath` is present).
     - 2. Seeded demo player's data:image `avatarUrl` (only when `acquisitionSource === 'seeded_demo'` and `avatarUrl.startsWith('data:image/')`).
     - 3. Numbered avatar preset (`/canton-quests/${key}.png`).
     - 4. Generic fallback preset (`/canton-quests/1.png`).
  3. **Privacy & Security Guarantees**:
     - Normal real users cannot inject `data:image/` URLs to bypass storage or profile validation (`acquisitionSource !== 'seeded_demo'`).
     - Private account fields (`email`, `userId` / `user_id`, `profileImagePath` / `profile_image_path`) are never exposed in the public roster payload.
     - The private `player-profile-images` storage bucket remains private with signed URL authorization.
  4. **Crop & Zoom Preservation**:
     - Public roster continues to return and honor `profileImageCropZoom`, `profileImageCropX`, and `profileImageCropY` for all players, including the 8 seeded demo faces (`RavenNorth`, `NikoCanton`, `AshCoded`, `MasonR`, `BreeNorthside`, `KJ_330`, `ToriTracks`, `JayceOnFoot`), rendering via `<PlayerAvatar>` and `getAvatarCropStyle`.
- **Reason**:
  - The 8 seeded demo roster players have generated face images stored as base64 data URIs in `players.avatar_url` with `profile_image_path = NULL`. Because `getPlayerRosterDB` previously only selected preset keys and profile image paths, the public roster fell back to preset icons instead of displaying their demo face portraits.
- **Status**: **ACCEPTED**

---

### [ADR-053] 2026-09-01: Confirmed Dead Schema Cleanup (Teams System & Legacy Prizes Table)

- **Decision**:
  1. **Production Schema Cleanup Completed**:
     - Applied dependency-safe cleanup migration `20260901140000_cleanup_dead_teams_and_legacy_prizes.sql` to live Supabase, removing `public.team_members`, `public.teams`, and `public.prizes` tables, as well as the four obsolete `team_id` foreign keys and columns from `quest_submissions`, `score_ledger`, `code_redemptions`, and `finale_qualifications`.
     - Zero `CASCADE` drop statements were used, and all fail-safe precondition assertions (0 rows / 0 non-null values) succeeded.
  2. **Runtime & Type Cleanup Deployed**:
     - Removed obsolete defensive `sub.team_id` handling in `lib/supabase-db.ts` (`awardQuestRewardsDB` and `reviewSubmissionDB`).
     - Removed obsolete `teamId?: string;` property from `CodeRedemption` in `lib/types.ts`.
     - Confirmed via regression tests and live production verification that the runtime no longer depends on the legacy team schema or obsolete `team_id` columns.
  3. **Fail-Safe Precondition Assertions & No-Cascade Invariant**:
     - The migration contains a strict PL/pgSQL assertion DO block validating that `teams`, `team_members`, `prizes`, and all four `team_id` columns are 100% empty (0 rows / 0 non-null values), aborting loudly with an exception otherwise before any object is touched.
     - Known foreign-key constraints are dropped explicitly before tables, with zero `CASCADE` drops.
  4. **Live Public Quest View Naming Correction**:
     - Documented canonical view name: the live public quest view is `public.public_quests` (not `public_quests_projection`). `public.public_quests` and its columns (`race_rewards`, `hints`, `risk_reward`, `required_collectible_id`) remain completely untouched.
  5. **Preservation of Planned and Live Infrastructure**:
     - `public.event_prizes` and `public.prize_draw_records` (transparent drawing system) remain the sole, authoritative prize infrastructure.
     - Live weekend tables (`live_events`, `field_npcs`, `player_links`, `player_personal_roles`, `watcher_eligibility`, `drawing_entry_ledger`, `host_broadcasts`, `audience_*`, `announcements`) remain untouched.
- **Reason**:
  - Eliminates technical debt from early Phase 2/3 prototypes and aligns the codebase strictly with the pure individual explorer model (ADR-023) and transparent prize drawing architecture (ADR-017 / ADR-020), while ensuring production schema changes are safely prepared and staged prior to live execution.
- **Status**: **ACCEPTED**










