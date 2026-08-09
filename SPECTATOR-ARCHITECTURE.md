# Canton Quests — Spectator Participation Architecture & Game System Design Audit

> **Governance Document**: Canonical architectural specification for the Canton Quests Spectator Participation & Audience Influence Subsystem.
> **Date**: August 9, 2026
> **Author**: Lead Builder (AI Boardroom)
> **Status**: APPROVED ARCHITECTURE AUDIT (REVISED & REMEDIATED)

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Existing System Capabilities (Reusable Foundation)
Inspection of the Canton Quests codebase ([`lib/types.ts`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/types.ts), [`lib/game-engine.ts`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/game-engine.ts), [`lib/supabase-db.ts`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/supabase-db.ts), [`lib/admin-auth.ts`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/admin-auth.ts), [`app/admin/live/page.tsx`](file:///Users/inkyaryan126/Desktop/canton-quests/app/admin/live/page.tsx), and [`supabase/migrations/`](file:///Users/inkyaryan126/Desktop/canton-quests/supabase/migrations/)) reveals a mature, highly functional foundation for live weekend event execution:

1. **Event State Machine & Phase Control**: The core engine supports explicit event phase transitions (`pre_game`, `opening`, `day_1`, `night_round`, `day_2`, `final_hours`, `finale`, `ended`) and emergency pause controls (`is_paused`, `pause_reason`).
2. **Live Game Director Control Room ([`app/admin/live/page.tsx`](file:///Users/inkyaryan126/Desktop/canton-quests/app/admin/live/page.tsx))**: Admins can broadcast ticker announcements ([`LiveAnnouncement`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/types.ts#L292)), trigger timed pop-up flash quests, release secret passcodes, update roaming NPC locations ([`NPCCharacter`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/types.ts#L344)), activate double/triple XP category bonus windows ([`BonusWindow`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/types.ts#L380)), track crowd objectives, and adjust score ledgers manually.
3. **Admin Security Helper ([`lib/admin-auth.ts`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/admin-auth.ts))**: Contains `verifyAdminSecret()` and `authorizeGameMasterRequest()` for verifying administrative authorization tokens.
4. **Immutable Score Ledger & Leaderboards**: Real-time player and squad rankings driven by `score_ledger` entries with automated score reconciliation.
5. **Real-Time Field Activity Stream**: Log engine capturing player joins, quest completions, flash drops, and phase changes ([`EventActivityItem`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/types.ts#L413)).
6. **Spatial Location Foundation**: Locations use `DOUBLE PRECISION` latitude and longitude columns (`locations` table in [`20260809000000_phase1_playable_core.sql`](file:///Users/inkyaryan126/Desktop/canton-quests/supabase/migrations/20260809000000_phase1_playable_core.sql#L36-L37)) paired with `map_center_lat` / `map_center_lon` in `events`. Geofencing and proximity calculations are computed via standard spherical Euclidean / Haversine bounding math, with `uuid-ossp` initialized in database migrations. (Note: Full PostGIS geometry types are not yet populated in Phase 1-4 tables; coordinate range matching and district bounding boxes handle spatial queries in the current schema).

### 1.2 Missing Spectator Capabilities & Security Prerequisites
The repository currently lacks the following spectator infrastructure and security prerequisites:
- **Unprotected `/admin/live` Route (Security Vulnerability)**: The current `/admin/live` client route is accessible without checking administrative authentication, and corresponding GM actions do not yet validate server-side authorization headers. Hardening `/admin/live` and enforcing server-side admin authorization via `authorizeGameMasterRequest` is a mandatory prerequisite before adding spectator control features.
- **No Dedicated Public Watch Interface**: No public `/watch` page exists for non-playing spectators.
- **No Audience Event Data Model**: Database lacks tables for audience events, vote options, vote records, or effect execution tracking.
- **No Public Feed Sanitizer**: Existing `EventActivityItem` logs expose raw player IDs and exact quest completion data, requiring privacy sanitization and time buffering before public display.
- **No Walk-Up Conversion Flow**: No 1-tap transition from watcher to playable Guest Player profile.
- **No Game Master Audience Control Studio**: `/admin/live` does not yet contain controls to draft, schedule, launch, pause, close, override, or emergency-kill audience events.

---

## 2. PROPOSED SPECTATOR ARCHITECTURE

### 2.1 Overall System Architecture
The Spectator Architecture turns Canton Quests into a live citywide game show. Spectators watching online or from sidewalk cafes follow the action in real time, participate in Host-driven votes, trigger controlled game effects, and can instantly enter the game as active players.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               PUBLIC SPECTATORS                                  │
│                 Browser Client @ /watch (Mobile PWA / Desktop)                   │
│   • District Activity Map   • Public Feed Ticker   • Interactive Vote Cards        │
└───────────────────────────────┬──────────────────────────────────────────────────┘
                                │ WebSockets (Supabase Realtime) / HTTPS API
┌───────────────────────────────▼──────────────────────────────────────────────────┐
│                         SPECTATOR INTERACTION SERVICES                           │
│   • Spectator Session Guard (Signed HTTP-Only Cookie + SHA-256 Session Hash)     │
│   • Public Feed Sanitizer (District Obfuscation + 2-Min Delay Buffer)             │
│   • Audience Event Engine (Vote Tallying + Diminishing Return Calculations)       │
└───────────────────────────────┬──────────────────────────────────────────────────┘
                                │ PostgreSQL RLS / Server Actions
┌───────────────────────────────▼──────────────────────────────────────────────────┐
│                            GAME MASTER CONTROL CENTER                            │
│                  Live Game Director @ /admin/live                                │
│   • Admin Authorization Guard (verifyAdminSecret / authorizeGameMasterRequest)   │
│   • Audience Event Studio   • Real-Time Vote Monitor   • Manual Outcome Override   │
│   • Feed Moderation Stream  • Emergency Audience Kill Switch                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Architectural Principles
1. **Real-World Safety Overrides Immersion**: Spectator influence must never encourage trespassing, dangerous driving, or player stalking.
2. **Non-Pay-To-Win Competitive Integrity**: Audience votes affect environmental factors (e.g., XP category multipliers, clue releases), never direct point purchasing.
3. **Game Master Ultimate Authority & Server-Side Security**: The Game Master maintains complete control to pause, override, or terminate any spectator event instantaneously. Server-side API endpoints for GM actions strictly require administrative authorization.
4. **Frictionless Walk-Up Onboarding**: Any spectator can convert into an active Guest Player in under 30 seconds with zero mandatory upfront sign-up forms.
5. **Strict Protection of Minors & Two-Tier Public Data Isolation**: Players under 18 years of age are strictly default-masked from public spectator feeds, live streams, and public leaderboards (`is_minor = true` forces anonymized handles `Agent #XXXX` and suppresses public photo/media exposure). Raw database tables (`audience_events`, `audience_event_options`) are locked from direct public SELECT queries and accessible only to GM Admins via RLS; public spectators query double-sanitized security barrier views (`public_audience_events` and `public_audience_event_options`) that mask internal target details, admin user IDs, manual override notes, and unreleased option effect payloads.

---

## 3. PLAYER & WATCHER USER JOURNEYS

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             USER JOURNEY MAP                                     │
├───────────────────┬──────────────────────────────────────────────────────────────┤
│ Persona           │ Primary Flow & Key Touchpoints                               │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ 1. Registered     │ Early Sign-up -> Squad Creation -> Pre-game Clues -> Start   │
│    Player         │ Line -> Category Sprints -> Finale Qualification             │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ 2. Walk-Up        │ Sees Street Action -> Scans QR @ 8:15 PM -> App Opens        │
│    Player         │ -> Instant Guest Profile (8:17 PM) -> 1st Quest (8:20 PM)    │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ 3. Public         │ Opens /watch -> Live District Activity -> Public Feed Ticker│
│    Spectator      │ -> Votes on Audience Event -> Visual Confirmation            │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ 4. Converting     │ Watcher on /watch -> Taps "ENTER THE GAME" -> Session Upgrade│
│    Spectator      │ -> Receives Spectator Bonus -> Directed to Nearby Quest      │
├───────────────────┼──────────────────────────────────────────────────────────────┤
│ 5. Late-Entry     │ Joins Sunday 10 AM -> Receives Catch-up Boost -> Competes    │
│    Player         │ for Single-Day Sprint & Master Decoder Category Awards       │
└───────────────────┴──────────────────────────────────────────────────────────────┘
```

### 3.1 Step-by-Step Journeys

#### Journey 1: The Early Registered Player
1. Receives event notification 48 hours before launch.
2. Forms a squad ("Team Gold"), invites 3 teammates, and picks an avatar symbol.
3. Arrives at Centennial Plaza on Friday 6:00 PM for Opening Launch.
4. Solves quest chains while monitoring squad leaderboard positioning.

#### Journey 2: The Walk-Up Player (Spontaneous Discovery)
1. **8:15 PM Saturday**: Person hears excitement downtown and scans a QR code on a poster.
2. **8:16 PM**: PWA opens in browser immediately without app store downloads or password forms.
3. **8:17 PM**: System presents a 2-step Onboarding Modal: (a) Age Selection (`18+` or `Under 18`; choosing `Under 18` flags `is_minor = true`, enforces mandatory adult/guardian team linkage per [`SAFETY-AND-RULES.md`](file:///Users/inkyaryan126/Desktop/canton-quests/SAFETY-AND-RULES.md#L28-L31), and locks public handle/media exposure), (b) Safety Code Acknowledgement (agreeing to obey pedestrian crosswalks, no trespassing, speed locks, dusk park curfews, and public property rules). Generates Guest Profile (`Agent #742`), prompts for location access, and shows "Begin Quest #1".
4. **8:20 PM**: Player completes nearby check-in mission, earns 100 XP, and joins the live event.

#### Journey 3: The Public Spectator (Watching from Home)
1. Opens `cantonquests.com/watch` on tablet or phone.
2. Views live district activity map showing relative heatwave intensity across Canton.
3. Reads Host broadcasts and sanitized public feed updates.
4. Votes on active poll card ("Select Category for 2X XP").
5. Sees live vote percentage bar update in real time.

#### Journey 4: The Converting Spectator ("ENTER THE GAME")
1. Watcher enjoying the live feed at a coffee shop decides to physically join.
2. Taps **"ENTER THE GAME"** action button on `/watch`.
3. System prompts for Age & Safety Acknowledgement if not previously completed. If user selects `Under 18`, account is flagged `is_minor = true` (enforcing minor privacy protections and adult-led team rules) before converting the active spectator session into a Guest Player profile.
4. Awards +50 XP "Spectator Pioneer" bonus badge.
5. App displays map marker for the nearest available starter quest 150m away.

#### Journey 5: The Late-Entry Player (Joining Mid-Event)
1. Opens app Sunday at 10:00 AM (26 hours into event).
2. Receives a **Late-Entry Catch-up Boost** (+15% XP on first 3 completed quests).
3. Strategic focus targets non-punitive categories: **"Sunday Sprint Champion"** and **"Master Decoder"**.
4. Tops the Sunday Sprint category leaderboard and earns an award at the 4:00 PM Event Finale.

---

## 4. AUDIENCE EVENT ENGINE

### 4.1 State Machine Lifecycle

```
 ┌──────────┐     GM Launch     ┌────────────────┐    Timer Expired    ┌──────────────────┐
 │  DRAFT   ├──────────────────►│ VOTING_ACTIVE  ├────────────────────►│ TALLYING_CLOSED  │
 └──────────┘                   └───────┬────────┘                     └────────┬─────────┘
                                        │                                       │
                                   GM Emergency                             Effect Applied
                                      Cancel                                    │
                                        │                                       ▼
                                        ▼                              ┌──────────────────┐
                                ┌───────────────┐                      │  EFFECT_APPLIED  │
                                │   CANCELLED   │                      └────────┬─────────┘
                                └───────────────┘                               │
                                                                           Event Resolved
                                                                                │
                                                                                ▼
                                                                       ┌──────────────────┐
                                                                       │     RESOLVED     │
                                                                       └──────────────────┘
```

### 4.2 Audience Event Types
1. **Audience Vote**: Multiple-choice poll with fixed duration (5–15 minutes).
   - *Example*: "Which category receives 2X XP for the next 30 minutes? [Puzzle / Exploration / Creative / Social]"
2. **Player / Team Benefit**: Audience selects target squad for a non-game-breaking clue boost.
   - *Example*: "Who receives the Host clue? [Team Gold / Team Raven / Team Chaos / All Players]"
3. **World Event Trigger**: Audience selects next citywide game drop.
   - *Example*: "What mystery unfolds next? [Deploy Roaming NPC / Unlock Secret Vault / Drop Flash Quest]"
4. **Crowd Meter**: Collective spectator action accumulator.
   - *Example*: "Reach 1,000 total audience taps to unlock Supply Drop #004."

### 4.3 Active Event Uniqueness & Auto-Resolution Mechanics
- **Single Active Event Index**: Database enforces max 1 simultaneous `voting_active` event per game event via partial unique index:
  `CREATE UNIQUE INDEX uq_single_active_audience_event ON public.audience_events (event_id) WHERE (status = 'voting_active');`
- **Server Auto-Resolution Trigger**: Active votes evaluate `ends_at <= NOW()`. When a client polls or fetches spectator state after `ends_at`, the server auto-transitions status to `tallying_closed`, selects the winning option, inserts an `audience_effects` record, and updates status to `resolved`. A background Edge Function / cron task runs every 15 seconds to ensure resolution even during zero-traffic windows.

---

## 5. LIVE FEED SYSTEM ARCHITECTURE

### 5.1 Feed Item Hierarchy & Operational Channels

| Feed Type | Source | Approval Required | Delay Rule | Styling & Tone |
| :--- | :--- | :--- | :--- | :--- |
| `HOST_BROADCAST` | GM Host Studio | Explicit GM Action | **0 Minutes (Instant)** | Gold/Crimson border, theatrical Host persona. Writes to `host_broadcasts` and `public_game_feed` with `is_host = true`. |
| `WORLD_UNLOCK` | Audience Vote / GM Drop | Automated on Event Resolution | **0 Minutes (Instant)** | Cyan/Purple flash card celebrating vote outcomes, NPC sightings, and supply drops. |
| `MILESTONE` | System Engine | Automated | **0 Minutes (Instant)** | Emerald card celebrating crowd milestones and participant count thresholds. |
| `GAMEPLAY_ACTIVITY` | Player Quest Submissions | Automated via Sanitizer Pipeline | **2 Minutes (Delayed Buffer)** | Obsidian glassmorphic card summarizing sanitized district completions. |

### 5.2 Privacy Filtering & Sanitization Protocol
Every raw activity log passes through the Public Feed Sanitizer before insertion into `public_game_feed`:

```typescript
function sanitizeActivityItem(raw: EventActivityItem): PublicFeedEntry | null {
  // 1. Map precise lat/lon to general district name
  const districtName = mapCoordinatesToDistrict(raw.lat, raw.lon); // "Downtown Arts Corridor"

  // 2. Anonymize player names unless explicit opt-in set
  const displayName = raw.isPublicOptIn ? raw.actorName : `Agent #${raw.actorId.slice(0, 4)}`;

  // 3. Apply 2-minute delay buffer for gameplay activities to prevent stream sniping
  const publishedAt = raw.type === 'quest_completed'
    ? new Date(Date.now() + 120000).toISOString()
    : new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    feedType: raw.type,
    headline: `${displayName} completed a quest in ${districtName}`,
    districtName,
    publishedAt,
    urgency: raw.urgency || 'info',
    isHost: false,
    isRetracted: false,
  };
}
```

### 5.3 Retention, History & Retraction Workflow
- **Active Window Retention**: `/watch` displays the latest 50 feed items. The database retains feed records for 7 days post-event before auto-archiving.
- **GM Moderation Retraction**: The Game Master can view the live feed in `/admin/live` and retract any entry with 1 click (`is_retracted = true`), removing it instantly from spectator sockets.

---

## 6. GAME MASTER CONTROLS (`/admin/live`)

### 6.0 Game Master Authorization Architecture (Hard Prerequisite)

Before any spectator controls are added to `/admin/live`, the route and its associated server actions must be secured against unauthorized access:

1. **Server-Only Administrative Authentication Boundary**:
   - Authentication must be handled strictly on the server via dedicated endpoints (e.g. `/api/admin/login`, `/api/admin/session` or Server Actions) using server-side environment variables (`process.env.ADMIN_SECRET_KEY`).
   - Client components on `/admin/live` or `/admin` MUST NOT import or execute secret-verifying logic (`verifyAdminSecret`) or bundle secret passphrases into browser JavaScript bundles.
   - Successful authentication establishes a secure, HTTP-only, SameSite session cookie (or server-side session token). Client components verify authorization state by querying a server-backed session endpoint (`/api/admin/session`) or via server component props.
   - Hardcoded default secrets (e.g. `'canton-gm-2026'`) are strictly prohibited as production fallbacks. Production authentication requires `process.env.ADMIN_SECRET_KEY` evaluated server-side.

2. **Server-Side API & Action Authorization**:
   - Every privileged action (creating audience event, launching vote, pausing, closing, overriding outcome, applying effects, emergency spectator kill switch) is processed via server API routes or Server Actions.
   - Every route executes `authorizeGameMasterRequest(req.headers)` or checks the HTTP-only admin session cookie server-side (or checks Supabase authenticated `role = 'admin'`).
   - Client-side UI visibility is NEVER treated as a security boundary. Unauthenticated requests receive immediate `401 Unauthorized` or `403 Forbidden` responses.

3. **Database RLS Authorization**:
   - Direct write access to `audience_events`, `audience_event_options`, `audience_effects`, `public_game_feed`, `host_broadcasts`, and `spectator_system_settings` requires `players.role = 'admin'` matching `auth.uid()`, or execution via Service Role from authorized server endpoints.


To grant full control to the Live Game Director, `/admin/live` will include the **Audience Control Studio**:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        AUDIENCE CONTROL SUITE (/admin/live)                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐ ┌────────────────────────────────────────────────┐ │
│ │ 🎯 AUDIENCE EVENT STUDIO  │ │ 📊 ACTIVE VOTE MONITOR                         │ │
│ │ Title: [2X XP Category  ] │ │ Prompt: "Select 2X XP Category"                │ │
│ │ Duration: [15 Minutes   ] │ │ Status: VOTING ACTIVE (08:42 Remaining)        │ │
│ │ Options:                  │ │ • Puzzle Quests       ████████████░░░  48%     │ │
│ │  1. Puzzle Quests         │ │ • Exploration Quests  ██████░░░░░░░░░  24%     │ │
│ │  2. Exploration Quests    │ │ • Creative Quests     █████░░░░░░░░░░  18%     │ │
│ │ [🚀 LAUNCH VOTE NOW]      │ │ [▶ PAUSE] [⏹ CLOSE] [🛑 OVERRIDE] [❌ CANCEL]    │ │
│ └───────────────────────────┘ └────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 🚨 GLOBAL KILL SWITCH: [ 🛑 EMERGENCY DISABLE ALL SPECTATOR INFLUENCE ]          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Complete Game Master Operations Matrix

| Operation | Action Description | Validation & Safety Rules | Database backing |
| :--- | :--- | :--- | :--- |
| **1. Create / Draft** | Form event title, description, vote type, options, duration, target configuration, and effect payloads. | Validates admin auth header; non-empty options and valid effect payload JSON. Event created in `draft` status. | `audience_events` (`status = 'draft'`), `audience_event_options` |
| **2. Schedule Event** | Set future `starts_at` timestamp for automated or manual launch. | Validates admin auth; must be after current time; cannot overlap existing active event. | `audience_events` (`starts_at`, `status = 'scheduled'`) |
| **3. Launch Immediately** | Set status to `voting_active` and `starts_at = NOW()`. | Validates admin auth; enforces single active event index constraint `uq_single_active_audience_event`. | `audience_events` (`status = 'voting_active'`, `starts_at`) |
| **4. Pause Voting** | Set `is_paused = true` and `paused_at = NOW()`. | Validates admin auth; freezes countdown timer and disables voting UI on `/watch` in real time. | `audience_events` (`is_paused = true`, `paused_at = NOW()`) |
| **5. Resume Voting** | Set `is_paused = false` and `paused_at = NULL`. | Validates admin auth; re-enables voting UI on connected spectator clients; extends `ends_at` by paused duration. | `audience_events` (`is_paused = false`, `paused_at = NULL`) |
| **6. Close Voting** | Set `status = 'tallying_closed'`. | Validates admin auth; locks vote intake; prepares vote totals for outcome resolution. | `audience_events` (`status = 'tallying_closed'`) |
| **7. Cancel Event** | Set `status = 'cancelled'`. | Validates admin auth; immediately hides voting widget from spectator views; no effect payload applied. | `audience_events` (`status = 'cancelled'`) |
| **8. Resolve Outcome** | Automatically tallies votes and applies winning option payload. | Validates admin auth; validates vote counts; records entry in `audience_effects`. | `audience_events` (`winning_option_id`, `status = 'resolved'`), `audience_effects` |
| **9. Manual Override** | GM explicitly chooses winning option, ignoring raw vote totals. | Validates admin auth; logged with GM identity and reason for audit transparency; resolves event with selected option. | `audience_events` (`winning_option_id`, `is_manually_overridden = true`, `override_reason`, `resolved_by`) |
| **10. Public Preview** | Admin pre-renders vote card visual presentation. | Validates admin auth; displays mock view on `/admin/live` without broadcasting to `/watch`. | Client-side preview renderer |
| **11. Participant Controls** | Configure voter eligibility (`all_spectators`, `authenticated_only`, `exclude_active_players`). | Checked during vote submission API validation and inside `cast_spectator_vote` RPC. | `audience_events` (`eligibility_mode`) |
| **12. Vote Count Limits** | Configure votes per session (e.g. `max_votes_per_session = 1`). | Enforced by `uq_spectator_vote_session_number` constraint, `check_spectator_vote_limit` trigger, and `cast_spectator_vote` RPC. | `audience_events` (`max_votes_per_session`), `audience_votes` (`vote_number`) |
| **13. Vote Duration** | Select 5, 10, 15, or 30 minute voting window. | Validates admin auth; sets `ends_at = NOW() + duration`. | `audience_events` (`ends_at`) |
| **14. Target Configuration** | Select category, quest ID, squad team, or citywide zone. | Validates admin auth; validated against target IDs in `quests`, `teams`, or `categories`. | `audience_events` (`target_type`, `target_id`, `target_name`) |
| **15. Reward / Effect Attach**| Attach effect payload (e.g. `{"multiplier": 2.0, "category": "puzzle"}`). | Validates admin auth; schema validated against recognized game engine effect handlers. | `audience_event_options` (`effect_payload`) |
| **16. Host Broadcast Trigger**| Auto-publish Host statement upon launch or resolution. | Validates admin auth; inserts record into `host_broadcasts` and `public_game_feed` simultaneously. | `host_broadcasts`, `public_game_feed` |
| **17. Emergency Disable** | Global kill switch disabling all spectator voting and hiding UI. | Validates admin auth; sets global spectator freeze flag in database and memory; stops all spectator API intake. | `spectator_system_settings` (`is_spectator_system_disabled = true`, `disabled_reason`) |

---

## 7. DATABASE DESIGN & SECURE RLS MODEL

The spectator engine design specifies 8 PostgreSQL tables/views with strict Row Level Security (RLS) policies to be added in Phase 5.1 migration `supabase/migrations/20260809400000_phase5_spectator_engine.sql`.

### 7.1 Security Architecture & Data Leak Prevention
- **Admin Role Hardening & Immutable Client Role Boundary**: The Phase 1 database migration (`supabase/migrations/20260809000000_phase1_playable_core.sql`) contained a permissive update policy allowing users to update their own `players` profile without restricting column modifications (`CREATE POLICY "Users can update their own player profile"`). If left unhardened, any authenticated client could issue a Supabase API call setting `role = 'admin'`, bypassing raw spectator table protections. Phase 5.1 explicitly hardens `public.players` BEFORE relying on `players.role = 'admin'` in any database RLS policies. It preserves legitimate profile edit ownership semantics using `USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL)` and attaches a PostgreSQL trigger (`trg_protect_player_role`) that raises an exception if `role` is mutated by any context other than `service_role` or authorized server processes. Furthermore, privileged Game Master operations are processed server-side (`/api/admin/...`) using server-evaluated `ADMIN_SECRET_KEY` and Supabase Service Role clients.
- **Two-Tier Public View Security & Event Metadata Isolation**: Direct `SELECT` queries on raw `audience_events` and `audience_event_options` tables are restricted exclusively to authenticated GM Admins (`role = 'admin'`). Public clients do NOT read the raw internal tables directly, because raw rows contain sensitive admin user IDs (`created_by`, `resolved_by`), internal GM override notes (`override_reason`, `is_manually_overridden`), unannounced target metadata (`target_id`, `target_name`), and unreleased option effect payloads (`effect_payload`). Instead, public spectators query double-sanitized security barrier views: `public_audience_events` and `public_audience_event_options`. These views expose public event titles, descriptions, status, timestamps, vote count totals, and vote eligibility rules while masking internal GM identifiers, hiding override notes, returning coarse target descriptions (`public_target_description`), and masking `effect_payload`. Views strictly filter to active/resolved events (`WHERE e.status IN ('voting_active', 'tallying_closed', 'effect_applied', 'resolved')`), completely concealing `draft`, `scheduled`, or `cancelled` events from public view.
- **Public Feed DB Read Boundary Protection for Minors & Public Eligibility**: `public_game_feed` tracks minor involvement (`is_minor_participant`) and public feed eligibility (`is_public_feed_eligible`). Rather than relying solely on application-layer sanitizers, the database SELECT RLS policy on `public_game_feed` strictly enforces `published_at <= NOW() AND is_retracted = false AND is_public_feed_eligible = true AND is_minor_participant = false`. Any feed item tagged as ineligible or involving a minor is automatically suppressed at the PostgreSQL read boundary for all public clients.
- **Composite Key Same-Event Enforcement**: `audience_event_options` includes `CONSTRAINT uq_option_id_event_id UNIQUE (id, audience_event_id)`. `audience_votes` includes `CONSTRAINT fk_vote_option_event FOREIGN KEY (option_id, audience_event_id) REFERENCES public.audience_event_options(id, audience_event_id) ON DELETE CASCADE`. This guarantees at the database schema level that a vote cannot pair an `option_id` with a different event's `audience_event_id`.
- **Correct SQL Privilege Order**: Functions (`cast_spectator_vote`, `register_or_update_spectator_session`, `convert_spectator_session_to_player`) are explicitly created via `CREATE OR REPLACE FUNCTION ...` BEFORE any `REVOKE EXECUTE` / `GRANT EXECUTE` statements are executed, ensuring valid PostgreSQL execution without missing symbol errors.
- **Server-Mediated Spectator Voting & RPC Execution Isolation**: Public direct `INSERT` access to `audience_votes` is explicitly revoked (`REVOKE INSERT ON public.audience_votes FROM anon, authenticated`). Crucially, public execution of `cast_spectator_vote` is also revoked (`REVOKE EXECUTE ON FUNCTION public.cast_spectator_vote FROM PUBLIC, anon, authenticated`), granting execution rights strictly to `service_role`. All public votes are intake-processed exclusively via the Next.js server route `/api/game/spectator`. The server route reads the HTTP-only spectator session cookie and client IP header (`x-forwarded-for`), hashes them server-side using SHA-256 with a secret server key (`SHA256(session_token + SERVER_SECRET)` and `SHA256(ip_address + SERVER_SECRET)`), verifies authenticated user context (`auth.uid()`), and invokes `cast_spectator_vote` using the Supabase Service Role client. Anonymous public clients cannot call the RPC directly to supply self-generated hashes or forge vote identities.
- **Database-Enforced Vote Count Limits**: In addition to `cast_spectator_vote` RPC validation, the database executes a PostgreSQL `BEFORE INSERT` trigger (`trg_enforce_spectator_vote_limit`) verifying `existing_votes < max_votes_per_session`. The unique constraint `CONSTRAINT uq_spectator_vote_session_number UNIQUE (audience_event_id, session_token_hash, vote_number)` guarantees strict uniqueness per vote slot and prevents race conditions under high concurrent volume.
- **Server-Mediated Spectator Sessions & Minor Protection Support**: Direct public writes (`INSERT`/`UPDATE`) to `spectator_sessions` are revoked. Direct execution of `register_or_update_spectator_session` and `convert_spectator_session_to_player` RPC functions is revoked from `PUBLIC`, `anon`, and `authenticated`, granting execution rights strictly to `service_role`. `spectator_sessions` tracks age acknowledgement, safety consent, and minor status (`is_minor`, `age_acknowledged_at`, `safety_acknowledged_at`). `public_game_feed` tracks minor involvement (`is_minor_participant`, `is_public_feed_eligible`). Session creation and spectator-to-player conversions are mediated exclusively by the server API (`/api/game/spectator`) using the Supabase Service Role client.
- **Explicit `SET search_path = public, pg_temp;` on `SECURITY DEFINER` RPCs**: All custom `SECURITY DEFINER` functions (`cast_spectator_vote`, `register_or_update_spectator_session`, `convert_spectator_session_to_player`) explicitly lock `search_path = public, pg_temp` to eliminate schema-shadowing attacks and prevent unauthorized object resolution in PostgreSQL/Supabase.
- **Strict RLS & Privileged Execution Boundary**: All 8 spectator tables enable Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Client access to public operations is mediated through public views (`public_audience_events`, `public_audience_event_options`, `public_game_feed`, `host_broadcasts`), while direct table writes and raw table reads are locked to hardened GM Admins (`role = 'admin'`) or Service Role server execution.


### 7.2 Implementation-Ready PostgreSQL Migration

```sql
-- Migration: 20260809400000_phase5_spectator_engine.sql

-- 1. Audience Events Table (Supports all GM controls & overrides)
CREATE TABLE IF NOT EXISTS public.audience_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('audience_vote', 'player_benefit', 'world_event', 'crowd_meter')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'voting_active', 'tallying_closed', 'effect_applied', 'resolved', 'cancelled')),
    is_paused BOOLEAN NOT NULL DEFAULT false,
    paused_at TIMESTAMPTZ,
    eligibility_mode TEXT NOT NULL DEFAULT 'all_spectators' CHECK (eligibility_mode IN ('all_spectators', 'authenticated_only', 'exclude_active_players')),
    max_votes_per_session INTEGER NOT NULL DEFAULT 1 CHECK (max_votes_per_session >= 1),
    target_type TEXT CHECK (target_type IN ('category', 'quest', 'team', 'zone', 'citywide')),
    target_id TEXT,
    target_name TEXT,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    winning_option_id UUID,
    is_manually_overridden BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    resolved_by UUID REFERENCES public.players(id),
    created_by UUID REFERENCES public.players(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial Unique Index: Prevent simultaneous active audience events for the same event
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_audience_event 
ON public.audience_events (event_id) 
WHERE (status = 'voting_active');

-- 1b. Public Audience Events View (Sanitizes internal admin IDs, target secrets, and manual override notes)
CREATE OR REPLACE VIEW public.public_audience_events 
WITH (security_barrier = true) AS
SELECT 
    e.id,
    e.event_id,
    e.title,
    e.description,
    e.event_type,
    e.status,
    e.is_paused,
    e.starts_at,
    e.ends_at,
    e.paused_at,
    e.eligibility_mode,
    e.max_votes_per_session,
    CASE 
        WHEN e.target_type = 'category' THEN e.target_name 
        ELSE 'Game Target' 
    END AS public_target_description,
    CASE 
        WHEN e.status = 'resolved' THEN e.winning_option_id 
        ELSE NULL 
    END AS public_winning_option_id,
    e.created_at
FROM public.audience_events e
WHERE e.status IN ('voting_active', 'tallying_closed', 'effect_applied', 'resolved');

-- 2. Audience Event Options Table (Internal DB Table containing effect_payload)
CREATE TABLE IF NOT EXISTS public.audience_event_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audience_event_id UUID NOT NULL REFERENCES public.audience_events(id) ON DELETE CASCADE,
    option_label TEXT NOT NULL,
    option_description TEXT,
    effect_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    vote_count INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_option_id_event_id UNIQUE (id, audience_event_id)
);

-- 2b. Public Audience Event Options View (Masks effect_payload AND restricts to active/resolved events)
CREATE OR REPLACE VIEW public.public_audience_event_options 
WITH (security_barrier = true) AS
SELECT 
    o.id,
    o.audience_event_id,
    o.option_label,
    o.option_description,
    o.vote_count,
    o.sort_order,
    o.created_at
FROM public.audience_event_options o
JOIN public.audience_events e ON e.id = o.audience_event_id
WHERE e.status IN ('voting_active', 'tallying_closed', 'effect_applied', 'resolved');

-- 3. Audience Votes Table (Server-Mediated & Strictly Limited)
CREATE TABLE IF NOT EXISTS public.audience_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audience_event_id UUID NOT NULL REFERENCES public.audience_events(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.audience_event_options(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL,
    vote_number INTEGER NOT NULL DEFAULT 1 CHECK (vote_number >= 1),
    ip_hash TEXT NOT NULL,
    player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_spectator_vote_session_number UNIQUE (audience_event_id, session_token_hash, vote_number),
    CONSTRAINT fk_vote_option_event FOREIGN KEY (option_id, audience_event_id) REFERENCES public.audience_event_options(id, audience_event_id) ON DELETE CASCADE
);

-- 4. Audience Effects Applied Ledger
CREATE TABLE IF NOT EXISTS public.audience_effects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audience_event_id UUID NOT NULL REFERENCES public.audience_events(id) ON DELETE CASCADE,
    effect_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed')),
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Public Game Feed Table (Sanitized Watch Stream with Minor Protection Flags)
CREATE TABLE IF NOT EXISTS public.public_game_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    feed_type TEXT NOT NULL,
    headline TEXT NOT NULL,
    body TEXT,
    district_name TEXT,
    urgency TEXT NOT NULL DEFAULT 'info' CHECK (urgency IN ('info', 'warning', 'flash', 'urgent')),
    is_host BOOLEAN NOT NULL DEFAULT false,
    is_retracted BOOLEAN NOT NULL DEFAULT false,
    is_minor_participant BOOLEAN NOT NULL DEFAULT false,
    is_public_feed_eligible BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Host Broadcasts Table
CREATE TABLE IF NOT EXISTS public.host_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    body TEXT NOT NULL,
    tone TEXT NOT NULL DEFAULT 'theatrical',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Spectator Sessions Ledger (Includes Minor & Age/Safety Onboarding Parameters)
CREATE TABLE IF NOT EXISTS public.spectator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token_hash TEXT UNIQUE NOT NULL,
    ip_hash TEXT NOT NULL,
    converted_to_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    is_minor BOOLEAN NOT NULL DEFAULT false,
    age_acknowledged_at TIMESTAMPTZ,
    safety_acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Spectator System Settings Table (Global Freeze / Emergency Disable)
CREATE TABLE IF NOT EXISTS public.spectator_system_settings (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    is_spectator_system_disabled BOOLEAN NOT NULL DEFAULT false,
    disabled_reason TEXT,
    disabled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_audience_events_lookup ON public.audience_events(event_id, status);
CREATE INDEX IF NOT EXISTS idx_audience_votes_lookup ON public.audience_votes(audience_event_id, session_token_hash);
CREATE INDEX IF NOT EXISTS idx_public_feed_published ON public.public_game_feed(event_id, published_at DESC) WHERE (is_retracted = false AND is_public_feed_eligible = true AND is_minor_participant = false);

-- Enable RLS on all Phase 5 tables
ALTER TABLE public.audience_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_event_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_game_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spectator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spectator_system_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- TRIGGER FUNCTIONS & TRIGGERS (Created BEFORE RPCs and Grants)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_spectator_vote_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_max INTEGER;
    v_count INTEGER;
BEGIN
    SELECT max_votes_per_session INTO v_max
    FROM public.audience_events
    WHERE id = NEW.audience_event_id;

    SELECT COUNT(*) INTO v_count
    FROM public.audience_votes
    WHERE audience_event_id = NEW.audience_event_id
      AND session_token_hash = NEW.session_token_hash
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_count >= v_max THEN
        RAISE EXCEPTION 'Vote limit exceeded: session already cast % votes (max allowed: %)', v_count, v_max;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_enforce_spectator_vote_limit
BEFORE INSERT ON public.audience_votes
FOR EACH ROW EXECUTE FUNCTION public.check_spectator_vote_limit();

-- 0. HARDEN PLAYERS ROLE INTEGRITY (Prerequisite for DB RLS Admin Policies)
DROP POLICY IF EXISTS "Users can update their own player profile" ON public.players;

CREATE POLICY "Users can update their own player profile" ON public.players
    FOR UPDATE 
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE OR REPLACE FUNCTION public.prevent_player_role_self_elevation()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.role IS DISTINCT FROM OLD.role) THEN
        IF (current_setting('role', true) <> 'service_role' AND auth.role() <> 'service_role') THEN
            RAISE EXCEPTION 'Unauthorized attempt to modify player role column.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_player_role ON public.players;
CREATE TRIGGER trg_protect_player_role
    BEFORE UPDATE ON public.players
    FOR EACH ROW
    WHEN (NEW.role IS DISTINCT FROM OLD.role)
    EXECUTE FUNCTION public.prevent_player_role_self_elevation();

-- -----------------------------------------------------------------------------
-- RPC FUNCTIONS (Created BEFORE Revoke/Grant Privilege Statements)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cast_spectator_vote(
    p_audience_event_id UUID,
    p_option_id UUID,
    p_session_token_hash TEXT,
    p_ip_hash TEXT,
    p_player_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_event public.audience_events;
    v_existing_votes INTEGER;
    v_next_vote_number INTEGER;
    v_vote_id UUID;
    v_updated_vote_count INTEGER;
BEGIN
    -- 1. Lock and validate audience event status and timing
    SELECT * INTO v_event 
    FROM public.audience_events 
    WHERE id = p_audience_event_id 
    FOR SHARE;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Audience event not found');
    END IF;

    IF v_event.status != 'voting_active' OR v_event.is_paused = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Voting is not active for this event');
    END IF;

    IF v_event.ends_at IS NOT NULL AND NOW() > v_event.ends_at THEN
        RETURN jsonb_build_object('success', false, 'error', 'Voting window has expired');
    END IF;

    -- 2. Verify option belongs to event (Enforced also by composite FK fk_vote_option_event)
    IF NOT EXISTS (
        SELECT 1 FROM public.audience_event_options 
        WHERE id = p_option_id AND audience_event_id = p_audience_event_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid option for this audience event');
    END IF;

    -- 3. Check voter eligibility mode
    IF v_event.eligibility_mode = 'authenticated_only' AND p_player_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required for this vote');
    END IF;

    IF v_event.eligibility_mode = 'exclude_active_players' AND p_player_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.quest_submissions 
            WHERE player_id = p_player_id 
              AND (status = 'pending' OR submitted_at >= NOW() - INTERVAL '30 minutes')
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Active quest players cannot participate in this spectator vote');
        END IF;
    END IF;

    -- 4. Check session vote count against max_votes_per_session
    SELECT COUNT(*) INTO v_existing_votes
    FROM public.audience_votes
    WHERE audience_event_id = p_audience_event_id
      AND session_token_hash = p_session_token_hash;

    IF v_existing_votes >= v_event.max_votes_per_session THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Session vote limit reached (%s of %s allowed)', v_existing_votes, v_event.max_votes_per_session),
            'code', 'VOTE_LIMIT_REACHED'
        );
    END IF;

    v_next_vote_number := v_existing_votes + 1;

    -- 5. Insert vote record safely
    INSERT INTO public.audience_votes (
        audience_event_id,
        option_id,
        session_token_hash,
        vote_number,
        ip_hash,
        player_id
    ) VALUES (
        p_audience_event_id,
        p_option_id,
        p_session_token_hash,
        v_next_vote_number,
        p_ip_hash,
        p_player_id
    ) RETURNING id INTO v_vote_id;

    -- 6. Increment vote count in options table
    UPDATE public.audience_event_options
    SET vote_count = vote_count + 1
    WHERE id = p_option_id
    RETURNING vote_count INTO v_updated_vote_count;

    RETURN jsonb_build_object(
        'success', true,
        'vote_id', v_vote_id,
        'vote_number', v_next_vote_number,
        'new_vote_count', v_updated_vote_count
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'Duplicate vote detected', 'code', 'DUPLICATE_VOTE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.register_or_update_spectator_session(
    p_session_token_hash TEXT,
    p_ip_hash TEXT,
    p_is_minor BOOLEAN DEFAULT false,
    p_age_acknowledged BOOLEAN DEFAULT false,
    p_safety_acknowledged BOOLEAN DEFAULT false
) RETURNS public.spectator_sessions AS $$
DECLARE
    v_session public.spectator_sessions;
BEGIN
    INSERT INTO public.spectator_sessions (
        session_token_hash, 
        ip_hash, 
        is_minor, 
        age_acknowledged_at, 
        safety_acknowledged_at, 
        last_seen_at
    )
    VALUES (
        p_session_token_hash, 
        p_ip_hash, 
        p_is_minor, 
        CASE WHEN p_age_acknowledged THEN NOW() ELSE NULL END,
        CASE WHEN p_safety_acknowledged THEN NOW() ELSE NULL END,
        NOW()
    )
    ON CONFLICT (session_token_hash)
    DO UPDATE SET 
        last_seen_at = NOW(), 
        ip_hash = EXCLUDED.ip_hash,
        is_minor = COALESCE(EXCLUDED.is_minor, spectator_sessions.is_minor),
        age_acknowledged_at = COALESCE(EXCLUDED.age_acknowledged_at, spectator_sessions.age_acknowledged_at),
        safety_acknowledged_at = COALESCE(EXCLUDED.safety_acknowledged_at, spectator_sessions.safety_acknowledged_at)
    RETURNING * INTO v_session;

    RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.convert_spectator_session_to_player(
    p_session_token_hash TEXT,
    p_player_id UUID
) RETURNS public.spectator_sessions AS $$
DECLARE
    v_session public.spectator_sessions;
BEGIN
    UPDATE public.spectator_sessions
    SET converted_to_player_id = p_player_id, last_seen_at = NOW()
    WHERE session_token_hash = p_session_token_hash
    RETURNING * INTO v_session;

    RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- -----------------------------------------------------------------------------
-- SECURE RLS POLICIES & PERMISSIONS (Executed AFTER function definitions)
-- -----------------------------------------------------------------------------

-- 1. Audience Events RLS (Direct table access restricted strictly to GM Admins; public reads public_audience_events view)
CREATE POLICY "Admin access only for raw audience_events" ON public.audience_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.players 
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- Grant Public read access ONLY on public_audience_events and public_audience_event_options views
GRANT SELECT ON public.public_audience_events TO anon, authenticated;
GRANT SELECT ON public.public_audience_event_options TO anon, authenticated;

-- 2. Audience Event Options RLS (Direct table access restricted to admins; public queries view)
CREATE POLICY "Admin full access to audience_event_options" ON public.audience_event_options
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.players 
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 3. Audience Votes RLS & RPC Execution Isolation
REVOKE INSERT, UPDATE, DELETE ON public.audience_votes FROM anon, authenticated;

-- Revoke RPC execution from public/unauthenticated roles to prevent hash forgery
REVOKE EXECUTE ON FUNCTION public.cast_spectator_vote(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_spectator_vote(UUID, UUID, TEXT, TEXT, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_or_update_spectator_session(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_or_update_spectator_session(TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;

REVOKE EXECUTE ON FUNCTION public.convert_spectator_session_to_player(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_spectator_session_to_player(TEXT, UUID) TO service_role;

CREATE POLICY "Admin view all votes" ON public.audience_votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.players 
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 4. Audience Effects RLS (Strict Admin Only)
CREATE POLICY "Admin access only for audience effects" ON public.audience_effects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.players 
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 5. Public Game Feed RLS
CREATE POLICY "Public read non-retracted published feed" ON public.public_game_feed
    FOR SELECT USING (
        published_at <= NOW() 
        AND is_retracted = false 
        AND is_public_feed_eligible = true 
        AND is_minor_participant = false
    );

CREATE POLICY "Admin write access for public feed" ON public.public_game_feed
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.players 
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 6. Host Broadcasts RLS
CREATE POLICY "Public read host broadcasts" ON public.host_broadcasts
    FOR SELECT USING (true);

CREATE POLICY "Admin write access for host broadcasts" ON public.host_broadcasts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.players 
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 7. Spectator Sessions RLS (Server-Mediated via API / SECURITY DEFINER RPCs)
CREATE POLICY "Admin view all spectator sessions" ON public.spectator_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.players 
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );

-- 8. Spectator System Settings RLS
CREATE POLICY "Public read spectator system settings" ON public.spectator_system_settings
    FOR SELECT USING (true);

CREATE POLICY "Admin write spectator system settings" ON public.spectator_system_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.players 
            WHERE players.user_id = auth.uid() AND players.role = 'admin'
        )
    );
```

---

## 8. REAL-TIME DELIVERY ARCHITECTURE

### 8.1 Technical Approach & Delivery Metrics
1. **Primary Channel: Supabase Realtime (WebSocket Broadcast)**
   - Clients subscribe to channel `realtime:spectator:{eventId}`.
   - Database mutations on `audience_event_options` (vote increments) and `public_game_feed` (new items) broadcast to connected `/watch` clients.
   - **Architectural Performance Target**: Sub-100ms update latency under standard network conditions.

2. **Optimistic UI Updates & Error Rollbacks**
   - When a spectator casts a vote, the UI immediately increments the local vote count bar optimistically.
   - If the server returns a duplicate vote conflict (`409 Conflict` / `uq_spectator_vote_session_number`), the UI gracefully rolls back the local increment and alerts "Vote Already Received".

3. **Fallback Polling Architecture**
   - If WebSocket connection disconnects or fails, `/watch` falls back to HTTP polling every 5 seconds to guarantee continuity on poor mobile cellular connections.

### 8.2 Architectural Performance Targets & Delivery Metrics
- **WebSocket Broadcast Latency Target**: `<100ms` update latency from server mutation to client UI rendering under standard mobile LTE / 5G networks.
- **Vote Intake API Latency Target**: `<150ms` processing duration for server-mediated `/api/game/spectator` vote intake RPC calls.
- **HTTP Fallback Polling Latency Target**: Adaptive 5-second polling window with conditional ETags (`304 Not Modified`) to minimize bandwidth consumption during socket degradation.
- **Server Execution Throughput Target**: Up to 200 RPC transactions per second via PostgreSQL connection pooling (`pgBouncer`).

### 8.3 Realtime & Load Validation Requirements
*(Note: Realtime latency and high-concurrency throughput metrics are specified as architectural targets and must be validated via load testing in Phase 5.4 prior to live event deployment.)*

1. **500 Spectator Scenario Load Validation**:
   - **Validation Protocol**: Synthetic load test executing 500 concurrent WebSocket connection instances on `realtime:spectator:{eventId}` while launching 10 vote bursts per minute.
   - **Target Criteria**: 0% socket drop rate, median update latency `<100ms`, client browser memory delta `<15MB`.

2. **5,000 Spectator High-Traffic Scenario Load Validation**:
   - **Validation Protocol**: Stress-test simulation scaling to 5,000 concurrent client socket connections with 50 vote submissions/sec hitting `/api/game/spectator`.
   - **Target Criteria**: 99.9% vote processing success rate, static Edge CDN response `<50ms` for cached `GET /api/game/spectator` public feed responses, Supabase pooler connection utilization `<75%`.
   - **Automated Fallback Trigger**: If socket error rate exceeds 2% or connection pooling latency exceeds 500ms, client Watch UI automatically initiates adaptive 5-second HTTP polling.

---

## 9. PRIVACY & SAFETY PROTECTIONS

### 9.1 Data Privacy & Location Isolation Protocol
- **No Exact Player Coordinates**: Exact GPS location coordinates are strictly private and never exposed to `/watch`.
- **District-Level Aggregation**: Public feed items reference district names ("Downtown Arts Corridor", "Central Plaza") rather than specific physical addresses.
- **Opt-In Player Names**: Player handles default to anonymized identifiers (`Agent #742`) unless explicit opt-in preferences are saved.
- **2-Minute Broadcast Delay**: Gameplay activity entries are held in a 2-minute delay buffer to prevent stream sniping or player trailing in competitive zones.
- **Two-Tier Public View Sanitization**: Raw database tables (`audience_events`, `audience_event_options`) are locked from public queries via admin-only RLS. Public clients read double-sanitized views (`public_audience_events` and `public_audience_event_options`) that mask internal admin IDs, hide manual override notes, filter out unreleased event options, and conceal internal GM target parameters.

### 9.2 Protection of Minors & Public Visibility Controls
- **Mandatory Default Anonymization for Minors**: Players under 18 years of age are strictly default-masked and prohibited from public display across all spectator interfaces, live feeds, public leaderboards, and Host announcements.
- **Engine-Enforced Name Suppression**: When an account is flagged `is_minor = true` (or initialized via minor age selection), the engine automatically overrides display names to anonymized handles (`Agent #XXXX`) regardless of whether profile settings attempt a public opt-in toggle.
- **Media & Photo Submission Protection**: Photos, camera verification proof, or video submissions submitted by minor accounts are automatically marked `is_public_feed_eligible = false` and excluded from public broadcast unless explicit verified parental/guardian consent is recorded on file by GM staff per [`SAFETY-AND-RULES.md`](file:///Users/inkyaryan126/Desktop/canton-quests/SAFETY-AND-RULES.md#L28-L31).

### 9.3 Walk-Up Age & Safety Acknowledgement Flow
- **Mandatory 2-Step Onboarding Modal**: Every walk-up or converting spectator completing the "ENTER THE GAME" flow must complete a 2-step acknowledgement modal:
  1. **Step 1: Age Gate**: User chooses `18+` or `Under 18`. Choosing `Under 18` sets `is_minor = true`, enforces mandatory parental/guardian accompaniment or adult-led team participation per [`SAFETY-AND-RULES.md`](file:///Users/inkyaryan126/Desktop/canton-quests/SAFETY-AND-RULES.md#L28-L31), and locks public handle/media exposure.
  2. **Step 2: Safety Code Acknowledgement**: User acknowledges Canton Quests Safety Rules (crosswalk compliance, no trespassing, no physical alterations, 15 mph speed locks, dusk park curfews, respect for public property).

### 9.4 Physical Safety Rules & Real-World Overrides
- **No Hazardous Area Drops**: Audience events never deploy flash quests into roadways, construction zones, or unlit night areas.
- **Real-World Safety Override**: Real-world safety rules continuously override theatrical Host lore. Emergency kill switch available to Game Master at all times.

---

## 10. ANTI-ABUSE & VOTING INTEGRITY

### 10.1 MVP Approach (Zero Paid Dependencies)
- **Signed Spectator Cookie**: HTTP-only cookie containing SHA-256 hashed session token (`cg_spec_token`).
- **Database Unique Constraint**: `uq_spectator_vote_session_number` enforces uniqueness per vote number per session hash per audience event at the PostgreSQL level.
- **DB Trigger Limit Enforcement**: PostgreSQL trigger `trg_enforce_spectator_vote_limit` ensures total session votes cannot exceed `max_votes_per_session`.
- **Server-Mediated Vote Intake & RPC Execution Isolation**: Direct `INSERT` access on `audience_votes` is revoked. Direct `EXECUTE` on `cast_spectator_vote` RPC is explicitly revoked from `PUBLIC`, `anon`, and `authenticated`, granting execution rights strictly to `service_role`. Public vote requests are intake-processed exclusively via the server route `/api/game/spectator`, which derives session token hashes and IP hashes server-side before invoking the RPC using Service Role.
- **Dependency-Free Sliding-Window Rate Limiter**: Server route API handles IP rate limiting via an in-memory sliding-window cache (or SQL-backed vote rate check) limiting vote submissions to 5 attempts per minute per IP hash. (This avoids requiring Upstash Redis in the initial MVP while providing clean rate protection).

### 10.2 Future Production Enhancements
- **Upstash Redis Rate Limiting**: Production deployment option for multi-region edge rate limiting as documented in [`TECH-ARCHITECTURE.md`](file:///Users/inkyaryan126/Desktop/canton-quests/TECH-ARCHITECTURE.md).
- **Automated Fingerprint / CAPTCHA**: Challenge triggers if vote velocity from a single IP subnet exceeds normal human thresholds.

---

## 11. COMPETITIVE FAIRNESS ANALYSIS

### 11.1 Core Guardrails for Protecting Game Integrity
Audience influence is strictly bounded by 4 baseline guardrails:

1. **Environmental Effects Only**: Votes alter environmental variables (e.g. "Double XP for Puzzle Quests", "Release Roaming NPC"), but cannot directly grant raw XP points to a specific squad.
2. **No Target Griefing**: Audience events cannot strip points or impose direct negative penalties on specific teams.
3. **Diminishing Returns**: If spectators repeatedly vote clue drops for the same squad, consecutive clues decay in value (100% -> 50% -> 25%).
4. **Strict Non-Pay-To-Win Policy**: Monetization (merch, supporter badges) conveys zero vote weighting advantages. 1 spectator = 1 vote.

### 11.2 Comprehensive Fairness Risk Matrix & Control Enforcement

| Threat / Risk Category | Specific Game Risk | Engine & Game System Mitigation / Control |
|---|---|---|
| **1. Repeated Target Selection** | Spectators repeatedly target or benefit a specific player or team, creating unequal gameplay conditions. | • **Cooldown Enforced**: Targets cannot receive audience benefits more than once every 60 minutes.<br>• **Diminishing Returns Formula**: Consecutive clues decay in effectiveness (100% -> 50% -> 25%).<br>• **GM Manual Override**: Game Master can remove over-targeted teams from option pools. |
| **2. Popularity Contests** | Locally famous players or popular streamers receive disproportionate crowd benefits over skilled unknown players. | • **Environmental Default**: Most audience votes target category-wide multipliers ("2X XP for Exploration") rather than specific players.<br>• **Blind Option Masking**: When team targets are offered, options are labeled anonymously ("Squad Alpha vs Squad Beta") or randomized by GM.<br>• **Category-Wide Scoring**: Non-targeted category sprints ensure skill-based paths to victory. |
| **3. Large Team Vote Manipulation** | Large teams direct non-playing team members or personal contacts to vote exclusively for their options. | • **1 Vote Per Session**: Enforced via signed HTTP cookies (`cg_spec_token`) + PostgreSQL unique constraint.<br>• **Active Player Voting Exclusion**: Active team members cannot vote on options directly benefiting their own team.<br>• **IP Rate Limits**: In-memory sliding-window limits submissions to 5 attempts/min per IP hash. |
| **4. Outside Friend Coordination** | Off-site Discord, Reddit, or social media groups brigade public voting pools from outside Canton. | • **Geofenced Weighting Option**: GM can require local IP subnet / physical bounding box check-in for 1.5x vote weight on high-stakes votes.<br>• **Macro-Level Effects**: Broad environmental impact ensures off-site votes affect all active players equally rather than deciding individual team outcomes. |
| **5. Spectator Griefing** | Spectators intentionally vote for options that harass, obstruct, or annoy active field players. | • **GM Option Pre-Approval**: All audience event options are curated and pre-screened by Game Master before publishing.<br>• **Negative Penalties Banned**: Mechanics that deduct points, freeze players, or force hazardous travel are strictly prohibited by system architecture. |
| **6. Stream Watching / Info Leaks** | Active players stream `/watch` on mobile devices to gain real-time intelligence on competitor positions or quest answers. | • **2-Minute Broadcast Delay**: Public feed items operate on a mandatory 2-minute delay buffer.<br>• **Coarse Location Aggregation**: No exact GPS coordinates exposed; feed displays only district names ("Downtown Arts Corridor").<br>• **No Answer Leaks**: Quest puzzle solutions are filtered out from public updates. |
| **7. Leaderboard Sniping** | Competitors monitor real-time spectator feed data to time late-game point jumps or hijack uncollected objectives. | • **Coarsened Leaderboards**: Public `/watch` leaderboard updates are delayed by 5 minutes or coarsened into tier ranks during active sprint phases.<br>• **Sanitized Quest Feed**: Feed entries report quest completions without revealing uncollected item locations. |
| **8. Local Fame Advantage** | Local Canton personalities, business owners, or influencers leverage their reach to secure spectator votes. | • **Anonymized Default Handles**: Player display names default to anonymized IDs (`Agent #XXXX`).<br>• **Universal Reward Impact**: Audience event outcomes unlock citywide drops or general category boosts open to all players. |
| **9. Vote Brigading / Bot Networks** | Scripted bots or automated vote farms inflate vote counts for specific options. | • **Cryptographic Tokens**: Session token hash (`cg_spec_token`) signed server-side.<br>• **Database Unique Constraints**: `uq_spectator_vote_session_number` rejects duplicate votes instantly.<br>• **Velocity Monitoring & 1-Click GM Invalidation**: GM dashboard flags vote spikes and permits single-click vote batch retraction. |
| **10. Late-Game Sabotage** | Spectators attempt to swing final leaderboard results by voting radical rule changes in closing event hours. | • **Audience Freeze Window**: Audience event system automatically freezes 60 minutes prior to final event conclusion.<br>• **No Finale Direct Influence**: Grand Finale push relies purely on player physical performance; spectator mode shifts to read-only broadcast mode.<br>• **GM Kill Switch**: Absolute GM authority to pause or cancel active spectator events at any time. |

---

## 12. CHAOS TEST (17 FAILURE SCENARIOS & MITIGATIONS)

| # | Failure Scenario | Risk Level | Automated / Manual Mitigation Strategy |
|---|------------------|------------|----------------------------------------|
| 1 | **5 Spectators** (Low Traffic) | Low | UI renders clean absolute vote counts; engine executes normally without minimum threshold blockers. |
| 2 | **500 Spectators** (Standard Event) | Low | Realtime broadcast performance target <100ms update latency; to be validated via Phase 5.4 synthetic WS socket benchmark suite. |
| 3 | **5,000 Spectators** (High Traffic Spike) | Medium | Connection pooling (pgBouncer) handles RPC calls; static Edge CDN caches public feed responses; performance target to be validated via 5,000-spectator stress simulation in Phase 5.4. |
| 4 | **Duplicate Voting Attempts** | Low | Unique constraint `uq_spectator_vote_session_number` & `cast_spectator_vote` RPC reject duplicate session votes instantly with 409 Conflict. |
| 5 | **Internet Connection Drops** | Medium | Client Watch UI retains optimistic state, queues retry, and switches to 5s HTTP polling fallback. |
| 6 | **Game Master Loses Connection** | High | Auto-resolution checks `ends_at <= NOW()`; server auto-resolves highest-voted option when timer expires. |
| 7 | **Event Launched Twice Accidentally** | Low | Partial unique index `uq_single_active_audience_event` prevents simultaneous active events. |
| 8 | **Audience Effect Fails After Winning Vote** | Medium | Error logger captures failure, alerts GM dashboard, and retries effect payload execution up to 3 times. |
| 9 | **Vote Manipulation / Bot Velocity** | High | Sliding-window IP rate limiter & velocity monitor alert GM; GM invalidates suspect vote batch with 1 click. |
| 10 | **Inappropriate Feed Entry** | Medium | Automated regex filter blocks profanity; GM retains 1-tap item retraction button on `/admin/live`. |
| 11 | **Player Opts Out of Public Visibility / Minor Account** | Low | User preference `is_publicly_visible = false` OR `is_minor = true` causes sanitizer to force anonymized handle (`Agent #XXXX`) and suppress all public photo/media proof. |
| 12 | **Player Joins Halfway Through Event** | Low | Walk-up onboarding awards Late-Entry Boost; non-punitive category leaderboards provide viable win paths. |
| 13 | **Spectator Becomes Player** | Low | Conversion endpoint upgrades spectator token to Guest Player profile while transferring accumulated supporter badges. |
| 14 | **Player Attempts Spectator Voting** | Low | Active players may vote in public spectator polls with standard 1x weight; cannot target own active quest. |
| 15 | **Deleted Quest Referenced in Vote** | Medium | Foreign key checks and precondition checks skip invalid quest references, logging a warning to GM control room. |
| 16 | **Emergency Field Event (Weather/Safety)** | Critical | GM triggers **Emergency Event Pause**; freeze signal broadcasts to all `/watch` sockets, displaying "EVENT PAUSED BY HOST" banner. |
| 17 | **Minor Player Attempts Opt-In Display Name or Photo Broadcast** | Low | Engine checks `is_minor = true`, rejects public opt-in override attempt, masks display handle, and sets `is_public_feed_eligible = false` on photo submissions. |

---

## 13. MVP DEFINITION

### 13.1 Included in Spectator MVP (Phase 5)
1. **`/admin/live` Security Prerequisite**: Route authorization guard and server-side authorization check (`authorizeGameMasterRequest`) for all GM actions.
2. **Public Watch Mode (`/watch`)**: Dark-mode responsive view featuring live district activity map, public feed ticker, and audience vote panel.
3. **Sanitized Public Feed (`public_game_feed`)**: Automated sanitizer converting system activity into delayed, district-level public updates.
4. **Audience Vote Engine**: Single-active vote system supporting Category XP Multipliers and General Clue Releases.
5. **Game Master Control Studio (`/admin/live`)**: Secured event creation modal, live vote monitor progress bar, manual outcome override, and emergency audience kill switch.
6. **Walk-Up Conversion Banner**: 1-tap "ENTER THE GAME" button converting spectator session into Guest Player profile.

### 13.2 Deferred Features (Future Iterations)
- Video stream embedding (Twitch / YouTube Live integration).
- User-to-user spectator chat room (deferred to avoid live moderation overhead).
- Paid supporter badges or microtransaction voting boosters (strictly prohibited by non-pay-to-win rules).

---

## 14. IMPLEMENTATION PHASES

Spectator implementation is divided into 4 small, testable, independent Boardroom missions:

### Mission 5.1 — Database Schema, Admin Security Prerequisite & Core Engine API
- **Goal**: Hardened server-only `/admin/live` security boundary (no client secret bundling or hardcoded production fallbacks), implement SQL migration `20260809400000_phase5_spectator_engine.sql` with double-sanitized public views (`public_audience_events` and `public_audience_event_options`), locked `search_path = public, pg_temp` on `SECURITY DEFINER` functions, minor safety protections and age/safety onboarding parameters, add TypeScript domain types to [`lib/types.ts`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/types.ts), add spectator functions to [`lib/game-engine.ts`](file:///Users/inkyaryan126/Desktop/canton-quests/lib/game-engine.ts), and create API route `/api/game/spectator`.
- **Key Deliverables**:
  - `/admin/live` server-only route authorization guard & server-side `authorizeGameMasterRequest()` / session cookie checks (no client secret verifier bundling or hardcoded fallback secrets).
  - 8 tables/views (`audience_events`, `public_audience_events` view masking internal admin IDs/targets/notes, `audience_event_options`, `public_audience_event_options` view joining active events only, `audience_votes`, `audience_effects`, `public_game_feed`, `host_broadcasts`, `spectator_sessions`, `spectator_system_settings`).
  - Strict RLS on `audience_events` restricting raw table access to GM Admins (`role = 'admin'`) only.
  - Minor safety protection defaults (`is_minor`, `age_acknowledged_at`, `safety_acknowledged_at` in `spectator_sessions`; `is_minor_participant`, `is_public_feed_eligible` in `public_game_feed`).
  - Correct PostgreSQL function privilege ordering (`CREATE OR REPLACE FUNCTION ...` before `REVOKE EXECUTE ...` and `GRANT EXECUTE ...`).
  - Composite FK constraint `fk_vote_option_event` enforcing same-event relationship between votes and options.
  - `SECURITY DEFINER` RPC functions (`cast_spectator_vote`, `register_or_update_spectator_session`, `convert_spectator_session_to_player`) explicitly locking `SET search_path = public, pg_temp;`.
  - DB trigger limit enforcement `trg_enforce_spectator_vote_limit`.
  - Sliding-window IP rate limiting on server routes.
- **Verification**: Write unit tests in `tests/phase5.1-spectator-engine.test.ts`.

### Mission 5.2 — Public Watch Mode Interface (`/watch`)
- **Goal**: Build `/watch` PWA page featuring district activity map, live feed ticker, audience vote card, and "ENTER THE GAME" conversion drawer with mandatory 2-step Age & Safety Gate Onboarding modal.
- **Verification**: End-to-end component rendering and interactive testing.

### Mission 5.3 — Live Game Director Control Suite (`/admin/live`)
- **Goal**: Extend secured `/admin/live` with Audience Event Studio modal, live vote tally visualizer, feed moderation tools, and emergency kill switch.
- **Verification**: Admin workflow manual and state change validation.

### Mission 5.4 — Real-Time Supabase Sync & Chaos Resilience Validation
- **Goal**: Wire up Supabase Realtime broadcast channels for live vote updates, implement network disconnect recovery, execute synthetic load-testing suite for 500 & 5,000 spectator scenarios to validate performance targets, and run end-to-end chaos verification test suite.
- **Verification**: Complete load and chaos test suite execution (`npm test`).

---

## 15. RECOMMENDED NEXT MISSION (`CURRENT_MISSION.md`)

The exact target specification for the next autonomous Boardroom mission is defined below:

```markdown
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
```


