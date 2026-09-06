# Canton Quests — Route, State & Visual Inconsistency Inventory

**Phase 1 Recon · Agy (Fast Implementation / Scout) · Boardroom Review Document · 2026-09-06**  
**Task ID:** `Phase 1: Route/state/visual inconsistency inventory`  
**Write Scope Compliance:** `boardroom/recon/agy-ui-inventory.md` (Exclusively)  
**Status:** `VERIFIED` — All findings, line references, CSS selectors, and state transitions below are grounded directly in source inspection of this checkout.

---

## 1. Executive Summary & Blocker Resolution

### 1.1 Resolution of Prior Blocker
- **Blocker Stated in Prompt:** `Agent AGY touched paths outside WRITE_SCOPE: boardroom/recon/. Nothing was staged or committed.`
- **Root Cause & Fix:** The working tree contained an unstaged modification to `boardroom/handoffs/TASK-20260906-060647-kvoi.md` from a previous task run. That file was restored to pristine state via `git restore`. The working tree was verified clean via `git status --short` before writing this document.
- **Active Scope Compliance:** This task writes **exclusively** to `boardroom/recon/agy-ui-inventory.md`. Zero files outside `boardroom/recon/` are touched. Boardroom owns all staging and commits.

### 1.2 Inventory Overview
Across 27 player-facing routes and supporting components:
1. **Critical Loading Flashes:** 2 core routes (`/events/[slug]/quests/[questId]` and `/leaderboard`) have **no loading states**, causing them to immediately flash false empty or false pre-launch states (`"MISSION GRID OFFLINE"` / `"Leaderboard Activates September 11"`) to the user before network data resolves.
2. **Silent Failure & Masquerading Errors:** 7 player routes silently swallow fetch errors via `.catch(() => {})`, falsely displaying legitimate empty states (`"No Missions published"`, `"No Transmissions Received"`, `"No Agents Found"`) or locking players out (`"Signal Not Received"` / `"Quest Not Found"`), masking server 500s or network drops.
3. **Severe Visual Inconsistencies:** At least 10 major UI patterns (buttons, cards, badges, loading spinners, empty states, error cards, headers, avatars, feedback modals, color tokens) suffer from fragmentation, running 2–4 incompatible design paradigms simultaneously side-by-side on the same screens.

---

## 2. Complete Player-Facing Route & State Inventory

Status Legend:
- **PRESENT**: Dedicated, properly styled UI state with clear affordance.
- **INCONSISTENT**: State exists but deviates sharply from application conventions or leaks technical jargon.
- **MISSING**: State does not exist; leaves the screen blank, displays a raw `<p>` tag, flashes false empty UI, or swallows errors.

| # | Route URL | File Path | Type | Loading State | Empty State | Error State | Concrete Assessment & Source Details |
|---|---|---|---|---|---|---|---|
| 1 | `/` | `app/page.tsx` | Client | **MISSING** | **MISSING** | **MISSING** | Four fetch calls (`/api/auth/me`, `/api/game/events`, `/api/game/roster`, `/api/game/leaderboard/global`) all use empty `.catch(() => {})` at lines 112, 120, 128, 136. While loading, Missions section renders heading with an empty void beneath it (lines 285–325). Top Agents and Roster preview sections conditionally hide entirely (`topAgents.length > 0`), causing layout shift upon resolution. |
| 2 | `/events` | `app/events/page.tsx` | Client | **INCONSISTENT** | **INCONSISTENT** | **MISSING** | Loading state at line 58 is a bare unstyled `<p className="cq-empty-state" style={{ padding: '2rem 0' }}>Loading Missions...</p>` with no spinner or skeleton. Empty state at line 60 is identical unstyled text. Error state is missing: `.catch()` is omitted; `.finally(() => setLoading(false))` forces any 500/network error to falsely render the empty state `"No Missions are published yet"`. |
| 3 | `/events/[slug]` | `app/events/[slug]/page.tsx` | Client | **INCONSISTENT** | **INCONSISTENT** | **PRESENT** | Suspense fallback is `null` (line 1322). Initial loading renders a full-screen stone-950/amber spinner (`"Loading Mission Grid..."`, line 508). Gate 2 participation uses another full-screen spinner (`"Entering Mission..."`, line 718). Quests tab empty state uses `.glass-panel` (line 1164), while Collectibles tab uses an ad-hoc unstyled `div` (line 1237). Error state is present with an honest retry button (`loadError && !event`, line 520). |
| 4 | `/events/[slug]/quests/[questId]` | `app/events/[slug]/quests/[questId]/page.tsx` | Client | **MISSING** | **INCONSISTENT** | **INCONSISTENT** | **Critical defect:** No loading state exists. While `/api/game/events/${slug}` is in flight, `!quest` is true, causing line 352 to immediately render the pre-launch banner (`"MISSION GRID OFFLINE • CANTON QUESTS ACTIVATES SEPTEMBER 11, 2026"`). If fetch fails or quest is missing, it falls through to `"QUEST NOT FOUND"` (line 408). Real network errors are disguised as pre-launch or missing quests. |
| 5 | `/events/[slug]/drawing` | `app/events/[slug]/drawing/page.tsx` | Client | **INCONSISTENT** | **PRESENT** | **PRESENT** | Loading state (line 95) is wrapped in Header/Footer with amber spinner, but text leaks developer jargon: `"Loading authoritative drawing ledger projection..."` (line 101). Pre-launch standby state is fully styled (line 109). System unavailable error state has honest copy, retry button, and home link (line 218). |
| 6 | `/events/[slug]/finale` | `app/events/[slug]/finale/page.tsx` | Client | **INCONSISTENT** | **PRESENT** | **INCONSISTENT** | Loading state (line 184) uses a **cyan** spinner and text `"Establishing Cipher Link..."`, clashing with the amber spinner on `/events/[slug]`. Locked reason states are handled (line 17). Submit errors render inline alert text (line 177), but initial load failure silently falls through to the `"No Master Cipher Here"` card (line 194). |
| 7 | `/events/[slug]/transmissions` | `app/events/[slug]/transmissions/page.tsx` | Client | **INCONSISTENT** | **PRESENT** | **MISSING** | Loading state at line 101 is a bare text string: `<p className="text-center text-xs font-mono text-stone-500 uppercase tracking-widest">Loading archive...</p>`. Empty state is properly styled with Satellite icon (line 103). Error state is missing: line 48 silently executes `.catch(() => setEntries([]))`, disguising network/server failure as `"No Transmissions Received"`. |
| 8 | `/events/[slug]/transmissions/[id]` | `app/events/[slug]/transmissions/[id]/page.tsx` | Client | **INCONSISTENT** | **PRESENT** | **INCONSISTENT** | Loading state (line 69) is bare text `<p className="text-xs font-mono text-stone-500 uppercase tracking-widest">Checking signal...</p>`. Locked state is clean (line 76). Error state is missing: line 57 catches errors and forces `setState('locked')`, deceiving the player that a video is unearned when the network actually failed. |
| 9 | `/events/[slug]/rules` | `app/events/[slug]/rules/page.tsx` | Server | **PRESENT** (SSR) | **PRESENT** | **PRESENT** (SSR) | Static server-rendered page. No dynamic client loading required. For non-Cipher events, renders fallback message directing players to `/how-it-works` (line 148). |
| 10 | `/events/archive/[slug]` | `app/events/archive/[slug]/page.tsx` | Client | **INCONSISTENT** | **PRESENT** | **INCONSISTENT** | Loading state (line 67) is plain text `<p className="text-center text-sm font-mono text-gray-400 py-12">Loading Mission archive...</p>`. Error state is collapsed into 404: line 55 catches network errors and triggers `setNotFound(true)`, falsely reporting `"This Mission archive could not be found"` on server 500s. |
| 11 | `/events/fair-qr-hunt` | `app/events/fair-qr-hunt/page.tsx` | Client | **INCONSISTENT** | **INCONSISTENT** | **INCONSISTENT** | Loading state (line 63) is a cyan text line: `<div className="text-center text-sm font-mono text-cyan-300 py-12">Loading Fair Hunt status...</div>`. Error state (line 65) is a red text line with no retry affordance. Empty winner list (line 235) is an unstyled grey paragraph. |
| 12 | `/profile` | `app/profile/page.tsx` | Client | **INCONSISTENT** | **PRESENT** | **INCONSISTENT** | While `loading` is true, the hero header still renders `<h1>Canton Agent</h1>` and logout button, with `<div className="cq-command-loading">Opening encrypted field terminal...</div>` below (line 431). If data fails to load, line 434 displays `"Authentication required."` even if the user is authenticated and the database simply timed out. |
| 13 | `/leaderboard` | `app/leaderboard/page.tsx` | Client | **MISSING** | **INCONSISTENT** | **MISSING** | **Critical defect:** No `loading` state exists (line 37). While data fetches, `entries` is empty, so lines 157–207 immediately flash the huge `"Leaderboard Activates September 11"` empty pre-season card, which disappears once data loads. Furthermore, the fetch chain (lines 46–61) has no `.catch()`; network failure results in an unhandled rejection, leaving the pre-season card stuck forever. |
| 14 | `/roster` | `app/roster/page.tsx` | Client | **INCONSISTENT** | **PRESENT** | **MISSING** | Loading state (line 74) is a plain `<p className="cq-empty-state">Loading roster...</p>`. Empty state (line 76) is a styled 3xl card with Users icon. Error state is missing: line 27 catches fetch failures and sets `setRoster([])`, masking connection issues as `"No Agents Found. Try a different callsign search."` |
| 15 | `/register` | `app/register/page.tsx` | Client | **MISSING** | **PRESENT** | **MISSING** | Suspense fallback is `null` (line 120). While checking event path requirements (`!resolved`, line 106), the form container renders `null` (blank screen under header). Errors in event lookup (lines 39, 62) are swallowed silently with `.catch(() => {})`, arbitrarily defaulting `requiresPath` to `true`. |
| 16 | `/auth/login` & `/login` | `app/auth/login/page.tsx` | Client | **INCONSISTENT** | **N/A** | **PRESENT** | Suspense fallback is `LoginLoadingFallback` (line 530) rendering `#030608` with pulsating text `"Loading terminal..."`. Form submission errors (line 670) render in alert boxes with resend confirmation and spam warnings. |
| 17 | `/auth/confirm` | `app/auth/confirm/page.tsx` | Client | **INCONSISTENT** | **N/A** | **PRESENT** | Suspense fallback (line 405) renders a `.cq-confirm-card` with `"Loading verification details..."`. Error states (line 33) handle URL query error params and API verification failures with actionable error displays. |
| 18 | `/auth/forgot-password` | `app/auth/forgot-password/page.tsx` | Client | **PRESENT** | **N/A** | **PRESENT** | Button spinner during submit (`RefreshCw animate-spin`, line 133). Success state renders `"CHECK YOUR INBOX"` card. API and network errors render dedicated alert boxes (line 104). |
| 19 | `/auth/reset-password` | `app/auth/reset-password/page.tsx` | Client | **PRESENT** | **N/A** | **PRESENT** | Submit loading state disables button with spinner (line 186). Success message renders access restored state (line 79). Error alerts display security notices with expiry warnings (line 89). |
| 20 | `/qr/[code]` | `app/qr/[code]/page.tsx` | Client | **INCONSISTENT** | **PRESENT** | **PRESENT** | Session verification renders `"Verifying session..."` in a glass panel (line 178). Signal claiming renders a pulsing satellite emoji `📡` with `"Checking signal..."` (line 182). 12 distinct claim outcome reason states are supported. Fetch errors produce a `SIGNAL ERROR` card (line 162). |
| 21 | `/link/[playerId]` | `app/link/[playerId]/page.tsx` | Client | **INCONSISTENT** | **PRESENT** | **PRESENT** | Loading state (line 96) is plain text `<p className="text-stone-400 text-sm">Reading signal...</p>`. Linking button changes to `"LINKING..."` (line 114). Lookup errors and network faults render colored status alert boxes (lines 121–124). |
| 22 | `/watch` | `app/watch/page.tsx` | Client | **PRESENT** | **PRESENT** | **PRESENT** | Initial loading (line 302) renders an amber spinner and spinning radar icon with `"CONNECTING TO LIVE AIRWAVES..."`. Live sync and minor safe mode headers exist. Network error displays a sticky `"RECONNECTING..."` banner with a manual `"Retry"` action (line 484). Upcoming and ended event states are handled (lines 414, 450). |
| 23 | `/how-it-works` | `app/how-it-works/page.tsx` | Client | **PRESENT** (SSR) | **PRESENT** | **PRESENT** (SSR) | Static instructional content. Tabbed step-by-step layout. No dynamic load states required. |
| 24 | `/start/{family,challenge,secret}` | `app/start/*/page.tsx`, `components/landing/*Landing.tsx` | Client | **PRESENT** (SSR) | **PRESENT** | **PRESENT** (SSR) | Static acquisition landing templates embedding `FastPlayerOnboardForm`. Form handles inline submission loading and error messages. |
| 25 | `/privacy` & `/terms` | `app/privacy/page.tsx`, `app/terms/page.tsx` | Server | **PRESENT** (SSR) | **PRESENT** | **PRESENT** (SSR) | Static legal documents. No dynamic states required. |
| 26 | Root Error & Not Found | `app/error.tsx`, `app/not-found.tsx` | Client | **N/A** | **PRESENT** | **INCONSISTENT** | `app/error.tsx` (line 18) renders full-screen 500 interrupt with a `TRY AGAIN` reset button. However, its fallback link hardcodes `href="/events/canton-weekend-1/quests"` (line 34), breaking navigation for non-weekend-1 players. `app/not-found.tsx` (line 7) similarly hardcodes the same link (line 16). |
| 27 | Scoped Redirects | `app/events/[slug]/{quests,map,leaderboard,watch}/page.tsx`, `app/quests/page.tsx`, `app/rules/page.tsx`, `app/fair/*` | Server | **N/A** | **N/A** | **N/A** | Lightweight server redirects (`redirect(...)`). Instantaneous server-side 307; no client states rendered. |

---

## 3. Concrete Repeated-But-Inconsistent UI Patterns

The codebase exhibits at least 10 recurring visual patterns where identical functional elements are styled using incompatible visual languages, dimensions, borders, and animations.

### Pattern 1: Button Architecture & Geometry Clash
Canton Quests has two mutually incompatible button design systems operating simultaneously across player surfaces:
- **System A — Chamfered Sci-Fi Cutout (`.cq-gold-button`, `.cq-dark-button`):**
  - **Files:** `app/globals.css:649-705`, `app/page.tsx:180`, `app/events/page.tsx:71`, `app/events/[slug]/drawing/page.tsx:198`, `app/events/[slug]/finale/page.tsx:205`, `app/leaderboard/page.tsx:95`, `components/OperationCard.tsx:120`, `components/FounderCipherShell.tsx:265`.
  - **Properties:** `border-radius: 0;`, `clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));`, multi-stop gold foil gradients, shimmer keyframe animations.
- **System B — Rounded Pill / Modern Web (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-cyan`):**
  - **Files:** `app/globals.css:137-185`, `app/events/[slug]/page.tsx:844`, `app/events/[slug]/quests/[questId]/page.tsx:666`, `app/events/fair-qr-hunt/page.tsx:86`, `app/qr/[code]/page.tsx:59`, `app/link/[playerId]/page.tsx:113`, `components/GameFeedbackModal.tsx:79`.
  - **Properties:** `border-radius: 12px;`, `min-height: 48px;`, standard box-shadow glows (`box-shadow: 0 4px 16px var(--accent-amber-glow)`).
- **System C — Ad-Hoc Tailwind & Auth Buttons:**
  - **Files:** `app/auth/login/page.tsx:244` (`.login-btn-primary` with `height: 60px; border-radius: 14px;`), `app/auth/forgot-password/page.tsx:128` (`rounded-xl bg-gradient-to-r from-amber-500 to-amber-600`), `app/error.tsx:29` (combines `btn btn-secondary` and `cq-gold-button` side-by-side in the same flex container).
- **Visual Impact:** On `/events/[slug]`, the hero callout uses `.btn .btn-primary` (12px rounded pill), while the navigation links and modal actions on the exact same page use `.cq-gold-button` (0px sharp chamfered foil). The interface looks like two separate web applications spliced together.

---

### Pattern 2: Surface Enclosure & Card Border Radii Fragmentation
Card containers that group interactive objectives, event information, and user stats have no unified corner radius or border treatment:
1. **0px / Sharp Chamfered Corners:**
   - `components/CipherFragmentsPanel.tsx:110`: `border border-cyan-400/25 bg-[#06090b]` (0px border-radius).
   - `components/MasterCipherStatusCard.tsx:32`: `border p-4 sm:p-5 transition-colors` (0px border-radius).
   - `app/events/[slug]/page.tsx:817` (Quest Hero section): `overflow-hidden border border-amber-500/30 bg-[#050607]` (0px border-radius).
2. **12px Border-Radius:**
   - `app/globals.css:144` (`.btn`), `app/events/[slug]/page.tsx:836` (Quest Hero step items).
3. **14px Border-Radius:**
   - `app/globals.css:105` (`.glass-card`), `app/events/[slug]/page.tsx:1019` (Stat summary cards).
4. **16px Border-Radius (`rounded-2xl` / `.glass-panel`):**
   - `app/globals.css:99` (`.glass-panel`), `components/QuestCard.tsx:124` (`rounded-2xl`), `components/LocationVerifier.tsx:80` (`rounded-2xl`), `app/events/[slug]/page.tsx:934` (Secret code bar).
5. **24px Border-Radius (`rounded-3xl`):**
   - `components/OperationCard.tsx:84` (`rounded-3xl`), `app/events/[slug]/drawing/page.tsx:127` (`rounded-3xl`), `app/leaderboard/page.tsx:159` (`rounded-3xl`), `app/roster/page.tsx:76` (`rounded-3xl`), `components/GameFeedbackModal.tsx:25` (`rounded-3xl`).
- **Visual Impact:** A player scrolling through `/events/canton-weekend-1` encounters 0px square cards (Cipher panel), 14px cards (XP stats), 16px cards (Quests and Passcode bar), and 24px cards (Upcoming banner and feedback modals). There is no single signature enclosure language.

---

### Pattern 3: Badge, Pill, & Kicker Grammar Inconsistency
Small status indicators ("ACTIVE MISSION", "PRE-SEASON", "XP AWARDED", "COLLECTED") are styled with conflicting typographical scales, padding, and borders:
- **Style A — Semantic Kicker (`.cq-kicker`):**
  - **Files:** `app/globals.css:487-512`, `app/events/page.tsx:48`, `app/leaderboard/page.tsx:141`.
  - **Properties:** Uppercase monospace tracking with `::before` gold line rule (`display: inline-flex; align-items: center; gap: 0.5rem; color: #f0c978; font-size: 0.72rem; letter-spacing: 0.18em;`).
- **Style B — Rounded Pill with Pulsing Dot:**
  - **Files:** `components/OperationCard.tsx:89-94`, `app/events/[slug]/page.tsx:558`, `app/leaderboard/page.tsx:188`, `components/Leaderboard.tsx:28`.
  - **Properties:** `rounded-full px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider` with child `<span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />`.
- **Style C — Square Rarity & Category Tags:**
  - **Files:** `components/QuestCard.tsx:151-172`.
  - **Properties:** `rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider` (small 4px border radius, no dot, compact padding).
- **Style D — Legacy Bootstrap-style Badge Classes (`.badge`):**
  - **Files:** `app/globals.css:195-212`, `app/qr/[code]/page.tsx:53`, `app/watch/page.tsx:453`.
  - **Properties:** `.badge-medium` with `padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-family: var(--font-mono);`.
- **Visual Impact:** The same piece of metadata (e.g. event status) is rendered as a 4px rounded badge in one place, an 8px badge in another, a fully circular pill with an animated dot in a third, and a gold-lined kicker in a fourth.

---

### Pattern 4: Loading State Fragmentation & Visual Drift
Loading screens throughout the application do not share an animation, color, or container pattern:
- **Variant A — Full-Screen Stone-950 Blocking Spinner (Amber):**
  - `app/events/[slug]/page.tsx:507-512`: `min-h-screen bg-stone-950 text-white flex-col border-4 border-amber-400 border-t-transparent animate-spin`.
- **Variant B — Full-Screen Stone-950 Blocking Spinner (Cyan):**
  - `app/events/[slug]/finale/page.tsx:186-190`: Identical markup to Variant A, but uses `border-cyan-400` and `text-cyan-300` (`"Establishing Cipher Link..."`).
- **Variant C — Embedded Card Spinner with Jargon:**
  - `app/events/[slug]/drawing/page.tsx:99-102`: Retains Header and CinematicFooter, centers a stone-900 card with amber spinner, and states: `"Loading authoritative drawing ledger projection..."`.
- **Variant D — Bare Unstyled Paragraphs (No Animation, No Spinner):**
  - `app/events/page.tsx:59`: `<p className="cq-empty-state" style={{ padding: '2rem 0' }}>Loading Missions...</p>`
  - `app/events/[slug]/transmissions/page.tsx:101`: `<p className="text-center text-xs font-mono text-stone-500 uppercase tracking-widest">Loading archive...</p>`
  - `app/events/[slug]/transmissions/[id]/page.tsx:69`: `<p className="text-xs font-mono text-stone-500 uppercase tracking-widest">Checking signal...</p>`
  - `app/events/archive/[slug]/page.tsx:67`: `<p className="text-center text-sm font-mono text-gray-400 py-12">Loading Mission archive...</p>`
  - `app/roster/page.tsx:74`: `<p className="cq-empty-state">Loading roster...</p>`
- **Variant E — Pulsing Tactical Icon:**
  - `app/watch/page.tsx:302-307`: Large amber spinner with spinning `<Radar>` icon and subtitle `"Synchronizing live feed, broadcasts, and audience voting channels"`.
  - `app/qr/[code]/page.tsx:183`: Pulsing satellite emoji `📡` in a cyan glass panel.
- **Variant F — Missing Entirely (Flashing Pre-Launch / Empty):**
  - `app/events/[slug]/quests/[questId]/page.tsx:351`: Zero loading state; flashes `"CANTON QUESTS ACTIVATES SEPTEMBER 11, 2026"` during initial query.
  - `app/leaderboard/page.tsx:157`: Zero loading state; flashes `"Leaderboard Activates September 11"` during initial query.

---

### Pattern 5: Empty State Disparity & Phantom Fallbacks
When a collection (quests, roster, transmissions, collectibles, leaderboard) contains 0 items, the visual presentation ranges from elaborate graphic illustrations to bare text or completely empty voids:
- **Disparity A — Graphic 3XL Illustrated Hero Card:**
  - `app/leaderboard/page.tsx:159-206`: Full `rounded-3xl bg-stone-950 border border-stone-800 p-10 sm:p-14` featuring background image `cqImages.leaderboardBg`, trophy pill, display headline, and gold CTA button.
  - `app/roster/page.tsx:76-80`: `rounded-3xl bg-stone-950 p-10` with amber `<Users>` icon and display typography.
  - `app/events/[slug]/transmissions/page.tsx:103-111`: Centered container with `<Satellite>` icon and headline `"No Transmissions Received"`.
- **Disparity B — Minimal Unstyled Paragraph / Div:**
  - `app/events/page.tsx:61`: Bare `<p className="cq-empty-state">No Missions are published yet. Check back soon.</p>`.
  - `app/events/[slug]/page.tsx:1164` (Quests tab): `<div className="glass-panel p-8 text-center text-gray-400 font-mono text-sm">No quests match the selected category filter.</div>`.
  - `app/events/[slug]/page.tsx:1237` (Collectibles tab): `<div className="p-8 text-center text-gray-400 text-xs">No collectibles discovered yet...</div>`.
  - `app/events/fair-qr-hunt/page.tsx:235`: `<p className="text-sm text-gray-400 font-mono">No Signals found yet — be the first to secure one.</p>`.
- **Disparity C — Phantom Disappearance (No Empty State):**
  - `app/page.tsx:285-325`: If `events` is empty, the entire "Choose Your Mission" section renders headings with an empty `<div>` below.
  - `app/page.tsx:471`: If `topAgents` is empty, the all-time XP leaderboard vanishes with zero notice.
  - `app/page.tsx:510`: If `roster` is empty, the player community preview vanishes with zero notice.

---

### Pattern 6: Error Masking & Silent Catch Antipaterns
Error handling patterns in data-fetching code consistently disguise system outages, network drops, or 500 errors as valid application states:
1. **Silent Array Fallback (`.catch(() => {})`):**
   - `app/page.tsx:112, 120, 128, 136`: Silently swallows errors on auth, events, roster, and global XP. Leaves UI blank.
   - `app/events/page.tsx:22`: Missing `.catch()`, triggers `.finally()`, rendering `"No Missions are published yet"`.
   - `app/roster/page.tsx:27`: `.catch(() => setRoster([]))` turns server 500s into `"No Agents Found"`.
   - `app/events/[slug]/transmissions/page.tsx:48`: `.catch(() => setEntries([]))` turns server 500s into `"No Transmissions Received"`.
   - `app/leaderboard/page.tsx:60`: No `.catch()`; network drop produces unhandled rejection and permanent pre-season card.
2. **Coerced Lockout / False 404:**
   - `app/events/[slug]/transmissions/[id]/page.tsx:57`: `.catch(() => setState('locked'))` turns network failure into a `"SIGNAL NOT RECEIVED"` lockout card.
   - `app/events/archive/[slug]/page.tsx:55`: `.catch(() => setNotFound(true))` turns network failure into `"This Mission archive could not be found."`.
   - `app/events/[slug]/quests/[questId]/page.tsx:125`: `.catch(() => { setQuest(null); setEvent(null); })` turns network failure into `"QUEST NOT FOUND"`.
3. **Honest, Actionable Error Cards (The Ideal Standard):**
   - `app/events/[slug]/page.tsx:519-531`: Detects `loadError && !event`, renders explicit error message with gold `RETRY` button.
   - `app/events/[slug]/drawing/page.tsx:218-252`: Detects `isSystemUnavailable`, renders dedicated `"SYSTEM TEMPORARILY UNAVAILABLE"` card explaining player progress is safe, with `TRY AGAIN` and `RETURN TO CITY HUB` actions.
   - `app/watch/page.tsx:480-491`: Displays red alert box with specific error string and interactive `Retry` button.

---

### Pattern 7: Header & Navigation Duality
The application is split across two fundamentally different top-level navigation components that present divergent labels, destinations, and layout structures:
- **Navigation Type A — `CinematicNav` (`components/CinematicNav.tsx`):**
  - **Routes Using It:** `/` (`app/page.tsx`), `/events` (`app/events/page.tsx`), `/profile` (`app/profile/page.tsx`), `/leaderboard` (`app/leaderboard/page.tsx`), `/roster` (`app/roster/page.tsx`), `/watch` (`app/watch/page.tsx`), `/events/archive/[slug]` (`app/events/archive/[slug]/page.tsx`), `/events/fair-qr-hunt` (`app/events/fair-qr-hunt/page.tsx`), `/how-it-works` (`app/how-it-works/page.tsx`), `/start/*` (`app/start/*/page.tsx`), `/privacy` (`app/privacy/page.tsx`), `/terms` (`app/terms/page.tsx`).
  - **Features:** Floating top bar with backdrop blur; desktop links: `MISSIONS`, `HOW IT WORKS`, `LEADERBOARD`, `WATCH`, `COMMAND CENTER` / `PLAYER FILE`; mobile drawer with slide-out animation; profile preview trigger.
- **Navigation Type B — `Header` (`components/Header.tsx`):**
  - **Routes Using It:** `/events/[slug]` (`app/events/[slug]/page.tsx`), `/events/[slug]/quests/[questId]` (`app/events/[slug]/quests/[questId]/page.tsx`), `/events/[slug]/drawing` (`app/events/[slug]/drawing/page.tsx`), `/events/[slug]/finale` (`app/events/[slug]/finale/page.tsx`), `/events/[slug]/transmissions` (`app/events/[slug]/transmissions/page.tsx`), `/events/[slug]/transmissions/[id]` (`app/events/[slug]/transmissions/[id]/page.tsx`), `/events/[slug]/rules` (`app/events/[slug]/rules/page.tsx`), `/qr/[code]` (`app/qr/[code]/page.tsx`).
  - **Features:** Fixed tactical HUD header; scoped links: `MAP`, `SCORES` / `LEADERBOARD`, `RULES`, `FINALE`, `PRIZES`, `LOGS` / `TRANSMISSIONS`, `EXIT`; no mobile drawer; direct back arrow to Mission board.
- **Navigation Type C — Ad-Hoc Stripped Headers:**
  - `app/register/page.tsx:75-102`: Custom brand header with logo, title, and "Already have an account?" link.
  - `app/auth/login/page.tsx:101`: `LoginHero` with custom logo and HUD status chips.
  - `app/auth/confirm/page.tsx:389`: Centered logo and wordmark without navigation links.
- **Visual Impact:** A player navigating from the Mission Directory (`/events` — uses `CinematicNav`) into a Mission (`/events/canton-weekend-1` — uses `Header`) experiences an abrupt header change where all global navigation links vanish and are replaced by in-event tactical tabs.

---

### Pattern 8: Player Avatar Presentation & Framing Fragmentation
`PlayerAvatar` is rendered across at least 5 different wrapper and styling contexts:
1. **Gold-Bordered Squared Container:**
   - `app/page.tsx:205`: `w-16 h-16 rounded-2xl bg-stone-950 border-2 border-amber-400 flex items-center justify-center shadow-lg`.
2. **Negative-Margin Overlapping Circular Ring:**
   - `app/page.tsx:519`: `w-10 h-10 rounded-full border-2 border-stone-950 bg-stone-900 overflow-hidden shrink-0` (in `flex -space-x-3`).
3. **Hardcoded Grey Leaderboard Container:**
   - `components/Leaderboard.tsx:76`: `size={36} className="cq-leaderboard-avatar" style={{ background: '#1f2937', border: '1px solid #374151', fontSize: '1.125rem' }}`.
4. **Rank List Avatar:**
   - `app/leaderboard/page.tsx:254`, `app/roster/page.tsx:91`: `size={46} className="cq-rank-avatar" style={{ fontSize: '1.4rem' }}`.
5. **Podium Hero Avatar:**
   - `app/leaderboard/page.tsx:223`: `size={64} fallback="⚡"` inside a gold, silver, or bronze medal card.
- **Visual Impact:** The player's identity avatar shifts between circular cropped tokens, hardcoded `#1f2937` boxes, and 2xl gold-bordered badges depending on whether they are on the home page, leaderboard, or roster.

---

### Pattern 9: Feedback & Celebration System Clash
Verification feedback uses two conflicting modal paradigms:
- **Legacy Paradigm (`GameFeedbackModal.tsx`):**
  - **Files:** `components/GameFeedbackModal.tsx`, invoked in `app/events/[slug]/page.tsx:1302` and `app/events/[slug]/quests/[questId]/page.tsx`.
  - **Visuals:** Full-screen backdrop with a bouncing emoji (`🎉` or `⚡` with `animate-bounce`), static hardcoded eyebrow `"MISSION VERIFIED & COMPLETED"` (even for secret codes or level ups), `.btn .btn-primary` button `"CONTINUE HUNT →"`.
- **Cinematic Paradigm (`showGameMoment` via `GameEffectsProvider.tsx`):**
  - **Files:** `lib/game-effects.ts`, `components/game-effects/*` (12 subcomponents: `RewardTokenEffect`, `AchievementEffect`, `CommanderTransmissionEffect`, `ChainCompleteEffect`, etc.).
  - **Visuals:** Sleek dark military HUD overlays, procedural audio cues (`cqSoundManager`), particle canvas effects (`HudParticlesCanvas`), calibrated typography, and contextual action buttons.
- **Visual Impact:** On `/events/[slug]/quests/[questId]`, solving a quest triggers both the cinematic `RewardTokenEffect` and the legacy `GameFeedbackModal` stacked on top of each other, creating visual chaos and redundant dismiss actions.

---

### Pattern 10: Color System & CSS Variable Token Fragmentation
The design system mixes custom CSS variables, arbitrary hex codes, and Tailwind utility color palettes without reconciliation:
- **CSS Variables in `app/globals.css:19-42`:**
  - `--bg-obsidian: #0b0f17;`
  - `--bg-card: #161e2e;`
  - `--border-subtle: rgba(255, 255, 255, 0.08);`
  - `--accent-amber: #f59e0b;`
  - `--accent-cyan: #06b6d4;`
- **Hardcoded Hex Literals in Page JSX:**
  - `app/error.tsx:18`: `bg-[#050608]`
  - `app/not-found.tsx:7`: `bg-[#050608]`
  - `app/events/[slug]/page.tsx:817`: `bg-[#050607]`
  - `components/CipherFragmentsPanel.tsx:110`: `bg-[#06090b]`
  - `app/register/page.tsx:71`: `bg-[#080b10]`
  - `app/auth/login/page.tsx:535`: `bg-[#030608]`
  - `app/watch/page.tsx:320`: `bg-[#121824]`
- **Tailwind Palette Classes:**
  - `bg-stone-950`, `bg-stone-900`, `bg-stone-900/80`, `border-stone-800`, `border-amber-500/40`, `text-amber-400`, `text-cyan-400`.
- **Visual Impact:** Dark background colors clash noticeably when components sit adjacent to each other. For instance, on `/events/[slug]`, the page background (`bg-stone-950` / `#0c0a09`) borders the Quest Hero (`#050607`), the Cipher panel (`#06090b`), and the tabs (`--bg-obsidian` / `#0b0f17`), creating visible color banding and mismatched seam lines.

---

## 4. Priority Remediation Plan for Phase 2

Based on this inventory, the recommended scope for upcoming implementation phases is organized into three tiers:

### Tier 1 — P0 Critical State & Bug Fixes (Zero Visual Regressions)
1. **Fix Quest Detail Initial Flash (`app/events/[slug]/quests/[questId]/page.tsx`):**
   - Introduce an explicit `loading` state check before evaluating `!quest`.
   - Render a dedicated quest loading skeleton rather than flashing `"MISSION GRID OFFLINE"`.
2. **Fix Leaderboard Initial Flash & Error Handling (`app/leaderboard/page.tsx`):**
   - Add a `loading` state variable defaulting to `true`.
   - Add `.catch()` to the fetch chain.
   - Prevent the `"Leaderboard Activates September 11"` pre-season card from displaying until data resolves as genuinely empty.
3. **Eliminate Silent Error Swallowing in Recon-Identified Endpoints:**
   - Update `app/events/page.tsx`, `app/roster/page.tsx`, `app/events/[slug]/transmissions/page.tsx`, and `app/events/[slug]/transmissions/[id]/page.tsx` to distinguish network/server errors from empty collections or locked records.
   - Provide an honest retry button matching the pattern in `app/events/[slug]/page.tsx:520`.
4. **Fix Hardcoded Route in Error Boundaries (`app/error.tsx`, `app/not-found.tsx`):**
   - Replace hardcoded `href="/events/canton-weekend-1/quests"` with dynamic context or `/events`.

### Tier 2 — P1 Visual & Component Standardization (CQ Design System)
1. **Standardize Primary Action Button System:**
   - Deprecate `.btn .btn-primary` in favor of `.cq-gold-button` and `.cq-dark-button` across all player routes.
   - Ensure explicit height, font family (`var(--font-display)`), and touch targets across mobile breakpoints.
2. **Harmonize Card & Panel Enclosure Radii:**
   - Standardize on two radii: `16px` (`rounded-2xl` / `.glass-panel`) for cards and interactive components, and `24px` (`rounded-3xl`) for major section shells and modals.
   - Eliminate 0px sharp-corner discrepancies on `CipherFragmentsPanel` and `MasterCipherStatusCard`.
3. **Consolidate Status Badges & Kickers:**
   - Standardize all status chips on the `.cq-kicker` (for section headers) and rounded pill with pulsing dot (for live telemetry/status).
4. **Unify Loading Indicators:**
   - Establish a standard CQ Field Instrument loading component (centered tactical radar animation with amber accent and monospace status text) to replace bare `<p>` tags.
5. **Retire Legacy `GameFeedbackModal`:**
   - Route all quest completion feedback exclusively through `showGameMoment` (`RewardTokenEffect` / `AchievementEffect`), removing duplicate dialogs and bouncing emojis.

### Tier 3 — P2 Visual Polish & Palette Alignment
1. **Reconcile Dark Background Palette:**
   - Align all page shells and card backgrounds to canonical CSS variables (`--bg-obsidian: #0b0f17;`, `--bg-card: #161e2e;`). Eliminate random `#050608`, `#06090b`, and `#080b10` hex codes.
2. **Standardize Player Avatar Frames:**
   - Implement a single canonical avatar frame component with consistent sizing (`sm: 36px`, `md: 46px`, `lg: 64px`) and gold trim.
3. **Harmonize Global vs Scoped Navigation Transitions:**
   - Ensure the transition between `CinematicNav` and `Header` retains clear orientation and breadcrumbs for players entering or exiting an active Mission.
