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
     - Upgraded `FastPlayerOnboardForm.tsx` and `EnterGameModal.tsx` to 2-step passwordless verification (Callsign + Email $\rightarrow$ 6-digit Magic Code $\rightarrow$ Enter Canton Quests).
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
