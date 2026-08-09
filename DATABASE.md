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
