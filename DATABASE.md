# Canton Quests — Conceptual Database Schema Specification

---

## 1. Overview & Security Architecture

The Canton Quests data architecture relies on PostgreSQL (hosted via Supabase) with PostGIS extensions for spatial queries and Row Level Security (RLS) policies enforcing strict player privacy, anti-cheat isolation, and multi-tenant scoping.

---

## 2. Entity Relationship Overview

```
 [cities] ──< [events] ──< [event_players] >── [players] >── [users (auth.users)]
               │                                   │
               ├──< [quests] ──< [quest_steps]     ├──< [team_members] >── [teams]
               │         │                         │
               │         └──< [quest_submissions] ─┴──< [scores]
               │
               ├──< [sponsors] ──< [business_partners]
               │
               └──< [collectibles] ──< [player_collectibles]
```

---

## 3. Detailed Entity Dictionary

### 3.1 `cities`
- **Purpose**: Scope game data by geographical city.
- **Fields**: `id` (uuid, PK), `name` (text), `slug` (text, unique), `state` (text), `bounding_box` (geography), `is_active` (boolean), `created_at` (timestamptz).
- **Relationships**: Has many `events`.
- **Security**: Public read; admin write.

### 3.2 `users` (App Extension of `auth.users`)
- **Purpose**: Store root system account details tied to Supabase Auth.
- **Fields**: `id` (uuid, PK, references auth.users), `email` (text), `phone` (text), `role` (enum: player, partner, admin), `created_at` (timestamptz).
- **Security**: User can only read/edit their own record (`auth.uid() = id`).

### 3.3 `players`
- **Purpose**: Store public player gaming identity, XP, and profile.
- **Fields**: `id` (uuid, PK), `user_id` (uuid, FK users), `display_name` (text), `avatar_url` (text), `total_xp` (integer), `level` (integer), `created_at` (timestamptz).
- **Relationships**: Belongs to `users`; has many `team_members`, `quest_submissions`, `scores`, `player_achievements`.
- **Security**: Public read for display_name/avatar; update restricted to owner.

### 3.4 `teams`
- **Purpose**: Manage group participation for weekend events.
- **Fields**: `id` (uuid, PK), `event_id` (uuid, FK events), `name` (text), `join_code` (text, unique), `captain_id` (uuid, FK players), `total_points` (integer), `created_at` (timestamptz).
- **Relationships**: Belongs to `events`; has many `team_members`.
- **Security**: Members can read team details; captain can edit team name / invite code.

### 3.5 `team_members`
- **Purpose**: Junction table linking players to teams per event.
- **Fields**: `id` (uuid, PK), `team_id` (uuid, FK teams), `player_id` (uuid, FK players), `joined_at` (timestamptz).
- **Security**: Members can read co-members' statuses.

### 3.6 `events`
- **Purpose**: High-level weekend event instance (e.g. Volume 1).
- **Fields**: `id` (uuid, PK), `city_id` (uuid, FK cities), `title` (text), `slug` (text), `start_time` (timestamptz), `end_time` (timestamptz), `status` (enum: draft, published, active, completed), `created_at` (timestamptz).
- **Relationships**: Belongs to `cities`; has many `quests`, `teams`, `event_players`.
- **Security**: Public read for published events.

### 3.7 `event_players`
- **Purpose**: Track registered players participating in a specific event.
- **Fields**: `id` (uuid, PK), `event_id` (uuid, FK events), `player_id` (uuid, FK players), `pass_tier` (enum: free, vip), `registered_at` (timestamptz).

### 3.8 `locations`
- **Purpose**: Physical geographic locations, landmarks, or storefronts in Canton.
- **Fields**: `id` (uuid, PK), `city_id` (uuid, FK cities), `name` (text), `address` (text), `coordinates` (geography(Point, 4326)), `is_partner` (boolean), `created_at` (timestamptz).
- **Security**: Public read for active quest nodes.

### 3.9 `business_partners`
- **Purpose**: Store local merchant details and sponsored venue info.
- **Fields**: `id` (uuid, PK), `location_id` (uuid, FK locations), `company_name` (text), `contact_email` (text), `perk_description` (text), `created_at` (timestamptz).

### 3.10 `sponsors`
- **Purpose**: Track event sponsors and promotional quest packages.
- **Fields**: `id` (uuid, PK), `event_id` (uuid, FK events), `name` (text), `tier` (enum: title, gold, silver, merchant), `logo_url` (text), `created_at` (timestamptz).

### 3.11 `quests`
- **Purpose**: Core quest definitions.
- **Fields**: `id` (uuid, PK), `event_id` (uuid, FK events), `title` (text), `description` (text), `category` (enum: exploration, puzzle, observation, creative, partner, flash, etc.), `base_points` (integer), `difficulty` (enum: easy, medium, hard, epic), `is_flash` (boolean), `expires_at` (timestamptz), `created_at` (timestamptz).
- **Relationships**: Has many `quest_steps`, `quest_submissions`.

### 3.12 `quest_steps`
- **Purpose**: Individual sequential steps/missions inside a quest.
- **Fields**: `id` (uuid, PK), `quest_id` (uuid, FK quests), `step_number` (integer), `instruction` (text), `verification_type` (enum: qr, gps, passphrase, photo, video), `target_code_hash` (text), `location_id` (uuid, FK locations), `radius_meters` (integer).
- **Security**: Secret target_code_hash and target location details hidden until previous steps are completed!

### 3.13 `quest_unlocks`
- **Purpose**: Track which players/teams have unlocked non-public or secret quest steps.
- **Fields**: `id` (uuid, PK), `quest_id` (uuid, FK quests), `player_id` (uuid, FK players), `team_id` (uuid, FK teams), `unlocked_at` (timestamptz).

### 3.14 `quest_submissions`
- **Purpose**: Log of all verification attempts submitted by players.
- **Fields**: `id` (uuid, PK), `quest_step_id` (uuid, FK quest_steps), `player_id` (uuid, FK players), `team_id` (uuid, FK teams), `submission_data` (jsonb), `proof_url` (text), `status` (enum: pending, verified, rejected), `verified_at` (timestamptz).
- **Security**: Players can only view their own submissions or team submissions.

### 3.15 `scores`
- **Purpose**: Ledger of point transactions awarded to players and teams.
- **Fields**: `id` (uuid, PK), `event_id` (uuid, FK events), `player_id` (uuid, FK players), `team_id` (uuid, FK teams), `quest_id` (uuid, FK quests), `points_awarded` (integer), `category` (text), `awarded_at` (timestamptz).

### 3.15.1 Core Quest Rewards Backbone
- **Purpose**: Authoritative reward chain for `event -> quest -> proof submission -> server verification -> persistent XP -> event-scoped drawing entries`.
- **Security Boundary**: Browser clients must use sanitized quest projections and server APIs. Raw `quests.target_code`, `quests.gm_notes`, and `quest_steps.target_code` remain server/database-side for verification only.
- **XP Idempotency**: Positive quest-completion XP is protected by a database partial unique index on `score_ledger(event_id, player_id, quest_id)` where `category = 'quest_completion'`. Manual/admin/bonus score transactions use different categories and are not blocked by this quest-completion idempotency rule.
- **Drawing Entries**: `drawing_entry_ledger` entries are scoped to the event where they were earned and are unique per `(event_id, player_id, quest_id)` for quest completions. Persistent XP may span events; drawing entries do not.
- **Public Transparency**: Raw `drawing_entry_ledger` is not publicly readable. Public transparency uses `public_drawing_ledger_projection`, a security-barrier view exposing public player labels, per-event qualified entry totals, total qualified event entries, and ledger lock metadata without raw `player_id`, `submission_id`, internal reasons, or audit metadata.
- **Multi-Step Progression**: `quest_submissions.completed_step_order` persists current player quest progression. Server verification determines the next valid step; clients cannot skip ahead by submitting an arbitrary step index. Quest-level XP and drawing entries are issued only after full quest completion.
- **GPS Verification**: GPS/check-in rewards require player coordinates, authoritative quest or step coordinates, radius validation, and server-side distance checks. Missing or outside-radius submissions award zero XP and zero drawing entries.

### 3.16 `achievements` & `player_achievements`
- **Purpose**: Permanent milestone badges (e.g. "Canton Historian").
- **Fields**: `id` (uuid, PK), `title` (text), `badge_icon_url` (text), `criteria` (jsonb).

### 3.17 `collectibles` & `player_collectibles`
- **Purpose**: Digital/physical artifacts discovered in Canton.
- **Fields**: `id` (uuid, PK), `name` (text), `description` (text), `3d_model_url` (text), `rarity` (enum: common, rare, legendary).

### 3.18 `rewards` & `prizes`
- **Purpose**: Trophy and reward catalog for finale and category champions.

### 3.19 `leaderboards` (Materialized View / Cache)
- **Purpose**: Pre-computed rankings by category to allow instant high-concurrency client polling during active weekend events.

### 3.20 `notifications` & `admin_events`
- **Purpose**: Log push alert broadcasts, flash event drops, and administrative system audits.

---

## 4. Phase 5 Spectator Engine Tables & Sanitized Public Security Barrier Views

### 4.1 `audience_events` & `public_audience_events`
- **Purpose**: Internal GM table storing audience event definitions, status (`draft`, `scheduled`, `voting_active`, `tallying_closed`, `effect_applied`, `resolved`, `cancelled`), target configurations, override reasons, and admin attribution.
- **Security & Public Isolation**: Direct `SELECT` queries on raw `audience_events` restricted strictly to GM Admins (`role = 'admin'`). Public clients query double-sanitized view `public_audience_events` (`WITH (security_barrier = true)`), which masks internal admin user IDs (`created_by`, `resolved_by`), target parameters, and manual override notes, filtering strictly to active/resolved states.
- **Invariants**: Enforces max 1 simultaneous active event per game event via partial unique index `uq_single_active_audience_event`.

### 4.2 `audience_event_options` & `public_audience_event_options`
- **Purpose**: Options spectators may vote on. Contains internal `effect_payload` JSONB and real-time `vote_count`.
- **Security & Public Isolation**: Direct table access restricted to admins. Public spectators query view `public_audience_event_options`, which masks internal `effect_payload` payloads and restricts rows to active/resolved events.
- **Invariants**: Composite unique key `CONSTRAINT uq_option_id_event_id UNIQUE (id, audience_event_id)`.

### 4.3 `audience_votes`
- **Purpose**: Ledger recording spectator votes.
- **Fields**: `id`, `audience_event_id`, `option_id`, `session_token_hash`, `vote_number`, `ip_hash`, `player_id`, `created_at`.
- **Security & Execution Isolation**: Direct public `INSERT` revoked. Direct RPC execution of `cast_spectator_vote` revoked from `PUBLIC, anon, authenticated` and granted strictly to `service_role`. Votes processed exclusively server-side via `/api/game/spectator`.
- **Invariants**:
  - Structural composite FK `CONSTRAINT fk_vote_option_event FOREIGN KEY (option_id, audience_event_id) REFERENCES public.audience_event_options(id, audience_event_id)` preventing votes for options belonging to different audience events.
  - Unique constraint `CONSTRAINT uq_spectator_one_vote_per_event UNIQUE (audience_event_id, session_token_hash)` preventing duplicate voting.
  - PostgreSQL trigger `trg_enforce_spectator_vote_limit` enforcing single vote per spectator session.

### 4.4 `audience_effects`
- **Purpose**: Authoritative server ledger of audience-generated gameplay effects and payloads.
- **Fields**: `id`, `audience_event_id`, `effect_type`, `payload`, `status` (`pending`, `applied`, `failed`, `cancelled`, `overridden`), `applied_at`, `resolved_at`, `cancellation_reason`, `override_context`, `created_by`, `applied_by`, `resolved_by`, `created_at`.
- **Security**: Admin access only (`players.role = 'admin'`). Public clients do not receive un-published effect payloads. Fully tracks lifecycle resolutions, cancellation reasons, manual overrides, and admin attribution.

### 4.5 `public_game_feed`
- **Purpose**: Stores sanitized public activity stream for spectator viewing.
- **Security & Privacy Read Boundary**: RLS SELECT policy strictly requires `published_at <= NOW() AND is_retracted = false AND is_public_feed_eligible = true AND is_minor_participant = false`. Ineligible rows and minor participant entries are suppressed at the database read boundary. Server sanitization boundary (`sanitizeTextContent`) automatically strips emails, phone numbers, exact geographic coordinates (mapping to coarse district names), secret passphrases/codes, admin notes, IP/token hashes, and private proof URLs. Gameplay activity logs operate on a 2-minute delay buffer.

### 4.6 `host_broadcasts`
- **Purpose**: Host/Game Master announcements for player and spectator channels.
- **Security**: Public read for published items; admin write.

### 4.7 `spectator_sessions`
- **Purpose**: Anonymous and identified spectator sessions with age acknowledgement, safety consent, and minor tracking (`is_minor`).
- **Security**: Direct public reads/writes revoked. Admin view only. Server API manages session creation and spectator-to-player conversions using Service Role. Spectator-to-player conversion strictly requires verified Supabase Auth JWT credentials, preventing player impersonation.

### 4.8 `spectator_system_settings`
- **Purpose**: Global spectator system state and emergency kill switch flags (`is_spectator_system_disabled`).
- **Security**: Public read; admin write.

---

## 5. Canonical Volume 1 Production Seed Restoration

- **Migration**: `20260814020000_restore_canton_volume1_production_seed.sql`
- **Purpose**: Fully restore the canonical Canton Quests Volume 1 game world into Supabase production tables.
- **Invariants**:
  - Deterministic UUID primary keys across `cities`, `locations`, `events`, `quests`, `quest_steps`, `collectibles`, `secret_codes`, `npc_characters`, `business_partners`, and `event_prizes`.
  - Non-destructive `INSERT ... ON CONFLICT (...) DO UPDATE / DO NOTHING` clauses.
  - Zero demo player accounts inserted (all players must onboard through Supabase Auth).
  - All secret verification targets hashed with SHA-256 (`sha256:...`).
  - Three-Path architecture districts fully mapped (`family`, `challenge`, `secret`, `cross_city`).
  - Frankenstein Monument cemetery access and safety rules enforced with coordinates `NULL` until physical field verification.

---

## 6. Single-Script Production Schema Catch-Up & Volume 1 Restore

- **Migration**: `20260814030000_production_schema_catchup_and_volume1_restore.sql`
- **Purpose**: Single idempotent, non-destructive catch-up migration enabling immediate single-paste execution in the Supabase SQL Editor. Safely brings a live database with Phase 3 schema (and early-executed critical player auth remediation `20260814010000`) up to the full modern schema requirements (Phase 4 Event Factory, Phase 5.1 Spectator Engine, Core Quest Rewards Backbone, Transparent Prize Drawing System, QR Campaign Attribution, Three-Path Architecture) and restores canonical Canton Quests Volume 1 game data in a single run.
- **Security Guarantee**: Hardened player authentication RLS policies, ownership triggers, and anti-tampering rules are guaranteed as the final authoritative security state.
