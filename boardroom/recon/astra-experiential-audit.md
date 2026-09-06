# Canton Quests — Phase 1 player journey and cinematic interaction architecture

**Author:** ASTRA · Boardroom-supervised · **Date:** 2026-09-06  
**Inspected baseline:** `2427ada` · **Deliverable:** architecture document only  
**Proposed language:** **Canton Field Protocol (CFP), version 1**

## 1. Finding and evidence boundary

Canton Quests already has the ingredients of issued field equipment: canonical door and quest artwork, a permanent Player Card, a Commander archive, a queued effects engine, real proof controls, recovered phrase tiles, and a server-gated Master Cipher. The discontinuity lies between those ingredients. Repeated promotional introductions, ambiguous entry states, conventional forms, and long reward sequences make the phone alternate between a website and a game instrument.

CFP makes the ordinary interaction trustworthy and tactile so the rare reveal feels earned. Every surface answers, in this order: **where am I, what is confirmed, what can I do next?** The city remains the activity; the screen helps the player return to it.

**Evidence labels:**

- **VERIFIED — source:** routes, JSX, conditions, labels, and trigger calls inspected in this checkout. This verifies their presence, not successful runtime execution.
- **HIGH_CONFIDENCE — experience inference:** likely friction inferred from source structure; no claim of measured perception, rendered contrast, or device performance.
- **PROPOSED:** the implementation contract for later phases. It is not already shipped or a change to game rules.
- **UNVERIFIED — runtime:** no local application server was listening during inspection. No authenticated browser traversal, proof submission, database configuration check, video/audio playback, screenshots, or deployment verification was performed. The journey below is a source walk through actual routes and branches, not a completed live playthrough.

Read: `PROJECT-BRAIN.md`, `boardroom/BOARDROOM.md`, `GAME-SYSTEM.md`, `TECH-ARCHITECTURE.md`, `DATABASE.md`, `SAFETY-AND-RULES.md`, `BRAND.md`, `PLAYER-JOURNEY.md`, and `skills/ux-designer.md`. Design-critique and design-system skill frameworks informed the audit. Older documents contain team-play and technology descriptions that conflict with current instructions. Individual play and the current task's CQ-prefixed custom CSS constraint govern this proposal. Existing Tailwind imports/classes were observed; they are not authorization to add utilities or undertake a styling migration.

### Scope and the prior blocker

Initial `git status --short` was empty. The reported earlier ASTRA out-of-scope edits were **not present in this checkout**. No cleanup, restore, staging, or commit was needed or attempted. The only intended write is this document under `boardroom/recon/`. Boardroom owns staging and committing. This proposal does not edit `DECISIONS.md`; adoption of a future architectural trade-off must be recorded by a separately scoped task.

## 2. The real journey, including branches and returns

Paths below are repository-relative source pointers. `:symbol` identifies a useful search anchor, not a second route. The sequence is not a mandatory funnel: returning players, QR visitors, and path-free Fair players enter at different points.

| Player surface / route | Current source and behavior — VERIFIED source | Experiential reading and direction — HIGH_CONFIDENCE / PROPOSED |
|---|---|---|
| Discovery and homepage `/` | `app/page.tsx` renders guest or cached/authenticated hero, mission collections, join steps, platform pillars, roster and top-agent previews; uses `CinematicNav`, `OperationCard`, `MobileStartBar`. Reads auth, events, roster, global leaderboard separately. | Good Canton identity, but the stacked promotional material reads as a landing page. Retain discovery content; returning players need a compact identity/context strip and an immediately visible route back to their chosen Mission. Do not invent a last-active Mission if no stored or server-supported value exists. |
| Mission directory `/events` and campaign entries `/start/family`, `/start/challenge`, `/start/secret` | `app/events/page.tsx`; start pages delegate to `components/landing/*Landing.tsx` and `lib/acquisition-landing-content.ts`. These are acquisition surfaces, not the authoritative quest board. | Keep the invitation and supplied artwork. Carry the actual intended destination through signup; a campaign theme must not look like a restriction on which quests can be played. |
| Registration `/register` | `app/register/page.tsx:RegisterContent` initializes `requiresPath=true`; bare `/register` shows `ThreePathSelector`. A `next=/events/...` request resolves event requirements; a `next=/qr/...` request uses `/api/qr/lookup`. Other destinations keep the default. | The homepage's “no starting path required” promise disagrees with the bare-register branch. Resolve this existing promise consistently in Phase 2; show requirement lookup status/failure rather than a blank form region or silently chosen experience. |
| Three doors / path selection | `components/ThreePathSelector.tsx:handleSelect` updates local selection and immediately emits `path-lock`. Selection scrolls to confirmation and may focus the callsign field after 450ms. `confirmOnly` calls the hub's `enterOperation(path)`. | Canonical three-door artwork is a strong flagship foundation. Preview and persistence currently share a lock metaphor. Separate **Path selected** from **Path confirmed**; avoid a save-sounding ceremony while merely browsing doors. |
| Account form and confirmation | `CreatePlayerIdentityPanel` reuses `FastPlayerOnboardForm`; the form calls `/api/auth/register` and supports password/login/email flows. `app/auth/confirm/page.tsx` resolves confirmation, optional callsign completion, and destination. `app/login/page.tsx`, `app/auth/login/page.tsx`, forgot/reset routes form the recovery branch. | Keep familiar labels and password-manager behavior. Treat the frame as issuing a Player Identity, but say “Check your email,” “Password,” and the real error plainly. Do not make a fake terminal typing sequence or new auth system. |
| Player File `/profile` | `app/profile/page.tsx` renders `PlayerCard`, avatar controls, identity completion, earned badge selection, social/profile controls, and server-backed profile reads/writes. `lib/player-file-nav.ts` centralizes profile navigation. | This is the strongest persistent equipment object. Preserve card art, badge slots, crop rules, privacy, and reward conditions. Give a saved-profile receipt near the edited control; retain a clear return to the intended Mission without forcing optional profile work first. |
| First Mission entry `/events/[slug]` | `app/events/[slug]/page.tsx` checks `/api/auth/me`, calls `/api/game/operations/${eventSlug}/enter`, stores participation, and handles error/retry. Entry API persists a universal `players.selected_starting_path`; the event path mirror is compatibility data. Gate 3 checks `authenticatedPlayer.selectedStartingPath`. | Establish identity → participation → path requirement → playable state as truthful steps. No “entered” solely from local display cache. Path changes voice/theme and recommendations, not access to other districts. Older event-path assumptions must not be reused. |
| Prelaunch, active, finale, ended hub | `FounderCipherShell.tsx` has lifecycle-specific badges and an always-present hero; children contain the hub/gates. Hub has a real request timeout/error branch, a second quest hero, GPS action, city status, code redemption, identity, cipher panels, recommendation, and tabs. | Persistent Mission identity is useful; repeated introductions bury the next action. In active/return visits, condense the same shell around the working board. Distinguish “Mission upcoming” from network failure and from completion of the player's cipher. |
| Opening briefing and path broadcasts | Hub first-entry effect emits `cipher_cold_open`, then `MISSION_BRIEFING` through `onFinished`. Path-required entry can also queue `cipher_three_doors`; successful path save can emit `cipher_path_selected`. Welcome/city videos use manual `WatchTransmissionButton` placements. | One opening chapter, with explicit Continue/Close and a recoverable briefing. Audit first-entry queue order rather than assuming the cold-open comment guarantees one total overlay. Never insert the Cold Open as a permanent hub video block. |
| Quest board `/events/[slug]/quests` | Route redirects to `/events/${slug}?tab=quests`; there is no separate board implementation. Hub filters/sorts and renders `QuestCard`. Card states include available, locked, pending, completed, flash, expired and claimed-out. | Use one state grammar across card and detail. Keep each canonical card intact; put current status/action in its existing surrounding UI. Recommendation is guidance, not access gating. Preserve query/deep-link behavior. |
| City map `/events/[slug]/map` | Redirects to the hub's map tab. Hub uses `CantonMapWrapper` and `SectorMapWrapper`; `SectorMap.tsx` creates a Leaflet map with OSM tiles/attribution and polls a spectator feed. | Map is the field instrument, not background decoration. Show real position acquisition, denial, and known location data. Never imply a sweep discovered a real target without data. `SectorMap`'s unscoped feed request is a follow-up scoping check, not proof of current cross-event leakage. |
| Quest briefing `/events/[slug]/quests/[questId]` | Detail page shows canonical artwork, proof/reward metadata, “Go here / Do this” information, directions, optional Commander briefings, prerequisite state and submission UI. Standalone artwork has a portrait contain branch. | Preserve readable destination and objective before decorative material. Fit proof controls into the same dossier frame as the briefing. Never crop or regenerate card art to make room. Distinguish listed possible rewards from actually awarded rewards. |
| Field proof and quest loop | Detail `handleSubmit` posts `/api/game/submit` with proof, event/quest and location context. Controls differ for GPS/check-in, passphrase/QR, media and multi-step proof. The inspected media controls accept a URL through `mediaUrlInput`; this is not a verified in-page camera/upload flow. `LocationVerifier` requests GPS and exposes denial/error. Pending review is distinct from verified completion. | **Ready → Sending → Under review / Verified / Needs correction / Connection issue.** Input and recovery remain available. A submitted photo is not an earned reward. Local GPS proximity is not server verification. QR text-entry copy is not proof that this screen has a camera scanner. |
| Reward and next objective | Detail routes successful results into game moments, fragments/locks, Commander messages, and next actions. `lib/game-effects.ts` supplies sequence support; `GameEffectsProvider` mounts one overlay globally. Persistent completed UI also uses quest configuration for displayed XP/entries. | Consolidate the response into a compact receipt and one significant reveal. Audit the completed summary's configured values against actual grant semantics before calling it a receipt. Retain a “Choose another quest” return without replaying rewards. |
| Physical scan `/qr/[code]`; Fair `/events/fair-qr-hunt` | QR page checks auth then calls `/api/qr/claim`; handles winner, prior/other claim, offline, unrecognized and error cases with return links. Fair has its own path-free dashboard, live map, cash winner instructions and ended state. | A real scan is already an excellent physical-to-digital moment. Present only confirmed claim results, preserve frozen QR IDs and current payment instructions. Reuse CFP states and frame without bringing Cipher doors, sigils, or finale into Fair. No live claim was made in this audit. |
| District fragment progression and decode | Hub renders `CipherFragmentsPanel` using `cipherProgress`. Districts show recovered fragments/counts and `in_progress`, `ready_to_decode`, `token_unlocked` statuses. Decode modal reorders three recovered phrase tiles and posts `/api/game/cipher/decode`. | Treat tiles as recovered evidence: readable, selectable and reorderable with the existing buttons. Each district stands independently. On successful decode, settle its Sigil and refresh authoritative progress; local tile order alone never unlocks it. |
| Founder Locks | Quest response `threeLocksFragmentAwarded`/`threeLocksOwned` drives `three-locks-fragment` and completion effects through `ThreeLocksFragmentEffect.tsx`; canonical messages distinguish first/second/third Lock. | MARK, CODE, WORD are **authorization**, separate from district phrase fragments and decoded Sigils. There is no separate Founder Lock route in this journey. Show the recovered key and 1/3, 2/3, 3/3 authorization receipt without implying all puzzle requirements are met. |
| Transmissions archive and replay | `/events/[slug]/transmissions` reads `/api/game/transmissions`; numbered player route adds `id` and sanitizes `returnTo`. Archive includes a client-side Commander text Field Log. `lib/commander-transmissions.ts`, `lib/commander-video-unlock.ts`, and viewed-state helpers have separate responsibilities. | Keep the archive as a field log, with the current server lock reason and contextual return. Viewed state suppresses automatic playback; it does not grant access. Client text logs are not proven cross-device history. Failure must not masquerade as locked/empty. Preserve portrait media, controls, and supplied titles. |
| Rankings, collectibles, city events and Watch | Hub has leaderboard/collectibles tabs, `LiveCityStatusPanel`, `CityPulseStrip`; global `/leaderboard` and `/roster` are separate surfaces. Scoped Watch route redirects to `/watch?eventSlug=...`, whose API reads carry scope. | Always label current Mission versus all-time XP. A city update occupies a small dispatch area unless it materially changes the next action. Existing Watch registration/voting is a side branch, not a prerequisite to play. Never invent activity, urgency or participants to make the HUD feel alive. |
| Master Cipher readiness | `MasterCipherStatusCard` uses `PlayerFinaleStatus`: Locked / Ready / Solved. `lib/finale.ts:checkFinaleEligibility` includes configuration, ended/open/close state, three Locks, required Sigils and optional Watcher eligibility. | Display **Evidence: district Sigils** and **Authorization: Founder Locks** separately, then the actual server eligibility reason. Three Sigils alone do not establish Ready. The hub already excludes its legacy drawing “Finale Status” stat for Cipher; preserve that correction. |
| Finale `/events/[slug]/finale` | Handles loading, non-Cipher, prelaunch, auth/participation, unavailable status, locked, ready and solved branches. Reads/posts `/api/game/finale`. Ready view shows clue pieces and solution input. Incorrect/false-finale outcomes are inline; completed queues `FINAL_SOLUTION_CORRECT` then `MISSION_COMPLETE`. | Make this the deliberate assembly of earned evidence, not merely a final web form. Incorrect stays calm and editable; false finale displays only returned reveal text. Solved persists independently of dismissal. A configured destination reveal is story evidence, not permission to mandate physical travel. |
| Drawing, results, return and safety | `/events/[slug]/drawing` contains official drawing/winner views and “THE FINAL QUEST”; `FinalQuestVerifierPanel` separates official metrics from its editable calculator. Event archive, rules, privacy, terms and recovery links support the journey. Finale solved view links to transmissions and Mission. | Call drawing results/eligibility explicitly drawing-related. A calculator output is not a Master Cipher solution, official winner, or prize grant. Keep rules and plain safety guidance easy to reach. Do not claim the older journey document's recap/forum/emergency-button concepts are implemented everywhere. |

## 3. Specific website-like seams to remove

These are source-grounded critiques, not claims that a browser defect was reproduced. P1 means resolve before flagship polish; P2 means coordinate with the relevant flagship.

| ID / priority | Current moment and source anchor | Why it breaks the equipment feeling | Concrete direction |
|---|---|---|---|
| G1 / P1 | Homepage path-free promise → bare `/register` with `requiresPath=true` | A signup funnel contradicts the invitation before the player receives an identity. | Align default registration with the already stated path-free promise; only show required path selection for a resolved context. Keep deep-link destination. |
| G2 / P1 | `ThreePathSelector.handleSelect` emits `path-lock` before confirmation | A selection widget pretends to complete an issuance ceremony. | Selection gets a local bracket/label; saved path gets the existing path moment after a successful authoritative response. Failure leaves selection editable. |
| G3 / P1 | `FounderCipherShell` persistent hero plus hub `dashboardCore` introductory hero | Repeated marketing and onboarding instructions separate a returning player from their field tools. | Retain Mission art/identity but collapse active-visit introduction into a compact context strip; board/next action leads. |
| G4 / P1 | Hub secret-code input: “Have a secret code?” + `REDEEM` | Looks like a coupon field and adds another undifferentiated form above the board. | Use “Field code” with “Verify code,” retaining the exact redemption API, server feedback and XP behavior. Do not imply it accepts district or finale answers. |
| G5 / P1 | Quest detail “Submit Proof Verification,” generic input/button frame, emoji success/pending blocks | The briefing becomes a website form, then a generic success panel. | Frame as “Field proof”; name the actual action: “Verify location,” “Submit photo proof,” or “Verify passphrase.” Follow with an inline confirmed-state receipt. |
| G6 / P1 | Transmission archive catches to `[]`; player loading failure ends in locked state | A content grid hides whether the equipment is disconnected or intelligence is genuinely unavailable. | Add distinct loading, empty, locked and connection-error presentations with Retry and contextual Return. Access decisions remain server-owned. |
| G7 / P2 | `CipherFragmentsPanel` progress bars, fragment rows, rearrangement modal | The important recovered evidence reads like a dashboard checklist detached from the quest that earned it. | Maintain readable phrase tiles and district identity across receipt → panel → decode. Use one seating motion after successful server decode, not another card system. |
| G8 / P2 | Finale “Submit Your Solution” + `SUBMIT` under a clue list | The culmination has the interaction shape of a contact form. | Present the same input as the final decode control beneath evidence and authorization status; use “Verify final decode.” Preserve actual eligibility and outcome branches. |
| G9 / P1 | `GameMomentOverlay` displays `+N QUEUED`; effects often last 2.5–4.5 seconds each | Exposes an animation queue as if it were a notification backlog; frequent achievements can compete with playing. | Combine routine grants into one receipt, reserve full-screen attention for milestones, retain Skip all, and keep earned results visible after skipping. |
| G10 / P1 | `Header`, `CinematicNav`, detail “Quest Hub,” shell “Mission Board,” drawing “THE FINAL QUEST” | The same tool acquires different labels while unrelated finales sound identical. | Use the vocabulary below in labels and contextual breadcrumbs without renaming API routes, IDs, or historical media titles. |

**Retain what already works:** canonical identity/card/door art; portrait video with controls; single effects queue; manual welcome/city replays; inline retry feedback; server-authored Master Cipher reasons; source separation between drawing and Cipher; real geographic context; path-flavored canonical messages.

## 4. Canton Field Protocol — one language, three scales

### 4.1 Object and copy vocabulary

CFP evokes an issued civic mystery instrument. Use no camouflage, aggressive military hierarchy, fake classified access levels, invented coordinates, or jargon where a child needs an instruction. Path voice comes from `lib/path-tone.ts` and `lib/gameplay/founders-cipher/`; do not create three separate UI languages.

| Term | Exact meaning and example |
|---|---|
| Command Center | Platform home `/`: permanent identity and Mission choice. |
| Player File / Player Card | Profile tool / its persistent visual identity artifact; preserve callsign and privacy semantics. |
| Mission | Player-facing name for the selected event context. Keep the supplied Mission title. Source `event` and `Operation` identifiers remain unchanged. |
| Quest / Objective | Playable challenge / the current step or proof task inside it. Label the working list **Quest Board**; contextual header: `[Mission title] / Quest Board`. This proposed copy normalization does not rename data models. |
| Field proof | Evidence the player submits. **Received** and **Verified** are different claims. |
| Dispatch / Transmission | A compact informational update / Commander content with explicit watch/read/return controls. “Transmission” does not automatically mean video. |
| Field Log | Existing replay/history area in the transmission archive; do not imply durable cross-device synchronization for local message history. |
| Fragment / Sigil | A recovered district phrase tile / the district reward after its sentence is verified. Never use “Lock” interchangeably. |
| Founder Lock | MARK, CODE or WORD authorization key. “Authorization complete: 3/3” still leaves evidence and other eligibility gates. |
| Master Cipher | The server-gated final decode. **Solved** only follows confirmed completion. |
| Drawing entry / Drawing results | Prize-drawing ledger participation / official published result. “Qualified” always names the drawing; no ambiguous “Finale qualified.” |

Sentence pattern: **fact → meaning → action**, usually one short line plus one helper line. Examples: “Proof received. Awaiting review. You can continue another quest.” “Sigil decoded. This district's evidence is complete.” “Connection interrupted. Your result has not been confirmed. Check status before retrying.” Do not substitute “Wrong code” for a transport error or “Signal lost” for a known invalid answer.

### 4.2 Frame, color and typography

Extend existing `.cq-*` components and CSS, using semantic aliases for existing tokens rather than a new theme provider. Suggested aliases below are **proposed**, not existing exports.

| Role | Baseline / CFP contract |
|---|---|
| Chassis | `--bg-obsidian: #0b0f17`; broad opaque background. Panel `--bg-card: #161e2e`; one restrained border. Artwork retains its existing frame/aspect ratio. |
| Text | `--text-primary: #f9fafb`; supporting `--text-secondary: #9ca3af`. Do not use muted gray for essential instructions or lock reasons. |
| Action / ready | Amber `--accent-amber: #f59e0b`, with icon/text. Reserve the filled primary control for the next meaningful action. |
| Information / acquisition | Cyan `--accent-cyan: #06b6d4`; brackets, active tool, pending acquisition. It is not proof of a working network. |
| Confirmed | Emerald `--accent-emerald: #10b981`; check glyph and explicit Verified/Solved label. |
| Caution / failure | Amber for waiting/needs attention; rose `--accent-rose: #f43f5e` for a blocking error with recovery text. No flashing warning borders. |
| Path accent | Family amber, Challenge red, Secret purple from existing path sources; used on identity/art perimeter. A red Challenge accent never means failure by itself. State icon/text wins over decorative path color. |
| Type | Retain Outfit (`--font-display`) for short titles, Inter (`--font-body`) for instructions/controls, JetBrains Mono (`--font-mono`) for codes/counts/status. Rajdhani exists; do not spread it into another competing interface type system. |
| Proposed scale | Body/input 16px minimum, supporting instructions 14px, nonessential metadata 12px; title 24–32px mobile, at most 48px desktop. Body line height 1.5; uppercase limited to short status/action labels. Never animate letters in a clue. |
| Geometry | 4/8/12/16/24/32px spacing; 8px control and 12px panel radius for new surrounding UI. Minimum 48×48px actionable hit areas. Reuse one border/bracket idiom, not bevels, neon outlines and glass on every element. |

All new visual classes use explicit names such as `.cq-field-status`, `.cq-field-status--verified`, `.cq-field-receipt`, `.cq-field-proof`, with real CSS in `app/globals.css`. These are naming proposals, not a request for duplicate React wrappers. Prefer adapting `PageHeader`, `Header`, `QuestCard`, `PlayerIdentityBar` and existing effect frames. Preserve the canonical logo and supplied card artwork.

Contrast ratios are **not measured in this audit**. Later validation must check actual foreground/background combinations, translucent overlays, focus rings and bright-light mobile readability; palette membership alone is not a contrast pass.

### 4.3 HUD state grammar

A status is always `icon + precise label + optional reason + relevant action`. Animation is supplemental. These names describe presentation; they do not replace backend enums.

| State | Appearance / copy | Real anchor |
|---|---|---|
| Idle | Static outline; “Choose a quest.” | Hub / `QuestCard` available state |
| Selected | Cyan bracket, “Path selected”; no earned receipt | `ThreePathSelector` local selection |
| Acquiring | Small bounded indicator, “Getting location…” / “Loading Mission…” | `LocationVerifier`, hub fetch |
| Sending | Busy control, stable form, “Submitting proof…”; no invented percentage | Quest submit request |
| Received / under review | Amber icon and “Awaiting review”; next-quest link | Pending submission |
| Ready | Amber action edge and exact action | `ready_to_decode`; finale eligibility `ok` |
| Locked | Static lock, readable server reason, relevant return | Prerequisite card / Master Cipher |
| Verified | Emerald check and confirmed result receipt | Successful proof/decode response |
| Needs correction | Inline explanation, preserved input/focus | Invalid proof/incorrect finale outcome |
| Connection issue | Distinct interrupted-link icon, Retry / Check status | Fetch timeout/error, never interpreted as empty or locked |
| Closed / expired | Static stop/clock label and actual closing reason | Event/flash/finale server or existing lifecycle state |
| Solved / archived | Stable completion/result artifact; replay remains optional | Finale `completedAt`, ended Mission |

Authentication, participation, path, connectivity, evidence, authorization and prizes are separate facts. Never compress them into one “ONLINE” light. A disabled control has an adjacent explanation; a hidden quest stays hidden, rather than exposing its details in a theatrical lock panel.

### 4.4 Motion and transitions

Use opacity/transform and native CSS/SVG. No new animation framework, Three.js, particle library, or cosmetic fetch pipeline. Boardroom's approximately 50KB gzip cosmetic-JS budget is a ceiling to measure later, not evidence that the present code meets it. Existing `HudParticlesCanvas` is an audit target, not a mandate to spread particles.

| CFP verb / proposed token | Timing and feel | Applied example |
|---|---|---|
| **Contact** / `--cq-motion-contact` | 90ms; control moves at most 1px or changes fill; no bounce | Door tap, proof button press; immediate local feedback only |
| **Acquire** / `--cq-motion-acquire` | 180ms `cubic-bezier(.2,.8,.2,1)`; bracket/underline resolves | Quest selection or GPS status change; sensor remains pending until real data |
| **Seat** / `--cq-motion-seat` | 240ms same easing; 4px translation to rest, then static | A returned fragment/Lock enters its existing receipt or evidence slot |
| **Handoff** / `--cq-motion-handoff` | 180–240ms opacity, optional ≤8px travel; no fake progress delay | Board → briefing → proof, preserving native history/back and scroll context |
| **Seal** / `--cq-motion-seal` | 420ms one ring/bracket closure around the affected object | Server-confirmed Sigil or third Lock; no screen shake |
| **Reveal** / `--cq-motion-reveal` | 600–900ms composition build, then indefinite readable hold | Cold Open frame or final solve; controls usable immediately; media retains its real duration |
| **Release** / `--cq-motion-release` | 120ms opacity; return focus to origin | Close/replay/skip, resume the working screen |

Reduced motion: no sweeps, particles, zoom, parallax or forced smooth scrolling; direct state changes or ≤100ms opacity. Keep the same facts, controls and reading time. Reduced motion must not mean shorter time to read. Ambient animation stops after one acknowledgement; no continuous pulsing of every “live” state.

Three attention scales, shared across every surface:

1. **Instrument:** selection, loading, error, GPS, input validation; inline, nonmodal, silent by default.
2. **Receipt:** routine verified proof, XP/entry grants, recovered evidence; compact, persistent in the working view. Optional visual emphasis settles in under 700ms. Use returned amounts; do not add up a fictional reward sequence.
3. **Chapter:** first Mission briefing, significant authorization/evidence milestone, final solution; the existing global overlay, explicitly dismissible and replayable where current content permits. One coherent chapter per result, not separate full-screen celebrations for every number.

`lib/game-effects.ts` currently has longer default moment holds (path 2500ms, quest 3200ms, Lock 4200ms, Lock completion 4500ms in normal motion). The proposed motion values govern visual entrance/settling, not automatic reading deadlines. Later work should consolidate routine moments and retain manual reading for chapters rather than simply shorten every existing timeout.

### 4.5 Sound restraint and accessibility

Use `lib/audio/cq-sound-manager.ts` and `cq-sound-map.ts`; `lib/game-audio.ts` already delegates major sounds to that manager and adds procedural oscillators for city scan/path lock. `PathLockEffect` calls this bridge. Retain one owner per cue and review the combined asset/synth level rather than introducing a replacement audio engine. Existing files under `public/audio/cq/` are available candidates; no listening or asset-by-asset quality verification was performed.

- **Contact:** ordinary navigation/typing is silent. Optional deliberate-confirm sound uses existing `ui_confirm`, no hover or per-character audio.
- **Receipt:** at most one quiet `quest_complete`, `chain_unlock`, or relevant path cue for one confirmed result; XP count animation does not add repeated ticks.
- **Chapter:** one `transmission` handshake before content, or one earned reveal cue. Speech/video takes priority; suppress decorative effects while it plays. No looping ambience or sirens in public space.
- **Correction:** inline text first; optional subdued `ui_error` only on an explicit failed action, never recurring on polling/retry.
- Keep `SoundToggleControl`, persisted mute/volume, gesture unlock and cooldown logic. Do not silently reset an existing preference. Recommended first-use sound opt-in is a future preference-policy decision, not permission to change defaults in this document.
- Sound never communicates the only clue, grants progress, blocks Continue, or substitutes for a text transcript. Do not invent video captions; inspect supplied transcript/caption availability and flag gaps for authorized transcription.
- Preserve visible focus, input labels, keyboard reordering and native password controls. The inspected `GameMomentOverlay` has Escape/Close/Skip but its outer wrapper does not provide a complete dialog/focus-management contract; Phase 2 must address dialog semantics, focus containment and restoration, background interaction, and polite state announcements. Do not announce animated counters frame by frame.

## 5. Phase 2 implementation handoff — core experience systems

All rows are future scoped tasks. None authorizes production edits in this Phase 1 run. Implement and review in this order; reuse existing utilities before adding abstractions.

| Task | Touchpoints for later authorized work | Exact deliverable and acceptance |
|---|---|---|
| P2-1: semantic presentation foundation | `app/globals.css`; existing `PageHeader`, `Header`, `CinematicNav`, `MobileStartBar` | Add CFP token aliases and explicit CQ classes; reconcile shared Mission/tool labels. At 390×844 and 430×932, next action, state reason and return remain readable and touchable; check 1280×800 and 1440×900 too. No card/logo redesign, Tailwind migration or new fonts. |
| P2-2: truthful entry and selection | `app/register/page.tsx`, `ThreePathSelector`, `FastPlayerOnboardForm`, hub `enterOperation` | Align bare registration with path-free promise, retain resolved event/QR requirements and `next`, separate selected/saving/saved/error. Emit saved-path ceremony only after actual persistence; returning universal-path players skip re-selection. Preserve cookie/session and rewards contracts. |
| P2-3: ordinary instrument states | Hub, quest detail, `LocationVerifier`, archive/player loading branches, `CipherFragmentsPanel` | Apply state table without changing verification rules. Empty, locked, denied and offline differ. Failed requests preserve recoverable input and never invent confirmation. Reuse hub's existing timeout/retry approach where appropriate. |
| P2-4: receipt and attention policy | `lib/game-effects.ts`, provider/overlay, proof/decode call sites, `lib/game-audio.ts`, audio manager | Retain single queue and sequence ordering; aggregate routine feedback from the same result, prevent duplicate audio, and preserve confirmed receipt after Skip all/navigation. Inspect `onFinished` chaining so skip/dismiss never grants progress or unexpectedly reopens a skipped chapter. Keep viewed-state dedupe distinct from reward idempotency. |
| P2-5: common accessible overlay | `GameMomentOverlay`, Commander text/video effects, decode dialog | Consistent dialog names, initial focus, Escape/Close, focus return, background protection, and reduced-motion behavior. Video/long-text accidental-backdrop protection remains. Controls are available throughout animations. |
| P2-6: continuity and scope | `FounderCipherShell`, hub tabs, map wrappers, Watch, rankings, drawing | Active hub leads with work; retain mission identity and discovery material in appropriate state. Preserve deep links/back and safe contextual return. Validate every data request's intended event scope, including SectorMap feed. No Cipher content in Fair; no global XP presented as event drawing entries. |

Required implementation tests later: focused state/trigger tests for save failure, repeated visit, pending proof, replay, server denial and skip; existing cinematic/audio/Commander/Cipher/finale suites; repository-required lint, typecheck and unit suite after code changes. Report baseline failures independently. This documentation-only run does not claim those checks passed.

## 6. Phase 3 implementation handoff — flagship moments

Build on P2 states, frame, motion, audio and overlay. These are authored presentations of existing results, not new progression mechanics.

| Moment / existing anchor | Trigger and storyboard | Recovery and acceptance |
|---|---|---|
| **Identity issued / Three Doors** — `ThreePathSelector`, `PathLockEffect`, account confirmation | Tap gives Contact + Selected. Player confirms; Saving persists. Successful server identity/path response gives one Seat/Seal on existing artwork, callsign/path and a Continue action. Existing path Commander content follows only in its legitimate context. | Save failure retains selection and shows real error; no “locked” ceremony. Preserve three-door hotspots, full artwork, path-free account branch and all-path quest access. Reduced motion shows the same static receipt. |
| **Mission received / Cold Open** — hub first-entry effect, `CommanderTransmissionEffect`, `MISSION_BRIEFING` | Confirm participation; frame the canonical Cold Open; then a readable briefing with the actual Mission objective. Keep welcome/city replays manual. Coordinate three-doors and achievement triggers into this first-entry order. | Close returns to the real gate/board; replay uses current archive eligibility. No permanent Cold Open promo block; no new footage or fabricated transmission titles. Verify first visit and revisit queue separately. |
| **Field proof accepted** — quest detail, `QuestCompleteEffect`, reward sequence | Sending remains in place. Verified response gives Receipt: quest title, actual granted XP/entries, recovered item if any, next action. Pending response gets Received, with no success sound or invented grant. | Revisit uses persisted result; duplicate submission does not duplicate ceremony/reward. Map/GPS permission denial does not block unrelated valid proof types. Ordinary repeat quests do not force multi-overlay ceremonies. |
| **District decoded** — `CipherFragmentsPanel`, decode endpoint, canonical Sigil messages | A returned fragment Seats into its district; 3/3 enables the actual reorder controls. Successful decode Seals that district, shows returned sentence/Sigil and updates the two progression tracks. | Wrong sequence stays inline with movable tiles. Any district can finish first. Reopening a completed panel does not re-award or replay automatically. Recovered words stay legible throughout motion. |
| **Founder authorization complete** — `ThreeLocksFragmentEffect`, `threeLocksOwned`, canonical Lock messages | Newly granted MARK/CODE/WORD Seats into its own slot. On third Lock, one Seal and “Authorization complete: 3/3”; show current evidence/eligibility alongside it. | Do not conflate phrase count, Sigils or drawing entries with authorization. If a Lock quest is unavailable awaiting field verification, preserve that block; no substitute quest, fake grant or location invented for the presentation. |
| **Master Cipher convergence and final reveal** — `MasterCipherStatusCard`, finale page, `FINAL_SOLUTION_CORRECT`, `MISSION_COMPLETE` | Locked shows the server reason. Ready places recovered evidence and authorization above “Verify final decode.” On `completed`, one Reveal through the existing Commander sequence; hold the solved artifact with actual destination reveal if provided, then archive/Mission return. | Wrong/false-finale responses remain distinct and inline. Skip leaves confirmed completion visible. Revisit loads solved state. Do not label the drawing as this finale, disclose answer hashes, manufacture a finale video, or turn a narrative destination into a mandatory physical checkpoint. |

## 7. Unresolved evidence and verification matrix

The written architecture is complete; runtime acceptance remains separate. Phase 2/3 should use a sanctioned test environment and authorized test identities rather than writing production claims to exercise effects.

| Scenario | Evidence needed before calling it verified |
|---|---|
| First-time guest | `/` → bare register; Mission-specific and QR-specific register; confirmation/callsign/recovery; ensure intended destination survives. Check no accidental path requirement for Fair. |
| Returning player | Server-authenticated entry with universal path, expired session, stale display cache, incomplete optional profile, back navigation. No repeated issuance/opening ceremony. |
| Complete quest loop | Real supported proof type → pending or verified response → receipt → refresh → next quest. Include incorrect answer, timeout, duplicate response and media review. |
| Device and network | Mobile viewport/keyboard overlap, 48px targets, GPS denied/unavailable, slow request, offline during submit, reduced motion, muted sound, keyboard and screen reader. Contrast/FPS/bundle size require measurements, not inspection claims. |
| Evidence + authorization | Each district independently, wrong/right tile order, all three Lock permutations, missing Locks with all Sigils, missing Sigils with all Locks. No other player's private fragments or secret targets appear. |
| Finale gating and solve | Unconfigured, not yet open, closed, event ended, optional Watcher gate, incorrect, false finale, completed, already completed; verify returned state persists after reload and skipped chapter. |
| Transmissions and scope | Missing/locked/available/failed fetch states; manual replay and contextual return; portrait playback and caption availability. Fair/global routes remain free of Cipher-only content. |
| Physical finale readiness | Finale source explicitly leaves West Lawn's mandatory checkpoint versus epilogue role unresolved pending on-site access/hours/route/visibility confirmation. Seed/test sources also mark some Founder Lock quests as field-confirmation dependent. Inspect current authorized configuration before claiming the full real-world chain is playable. This audit does not clear those blockers. |

### Acceptance checkpoint for this document

- **PASS — source coverage:** discovery, registration/path variants, authentication/recovery, profile, entry/lifecycle, quest board/map, proof/reward loop, QR/Fair, transmissions, fragments/Sigils, Founder Locks, Master Cipher/finale, drawing/results, and return/safety surfaces are addressed.
- **PASS — architecture:** named vocabulary, state semantics, token/typography discipline, motion timings, sound policy, attention scales and component-specific Phase 2/3 work are defined.
- **PASS — critique:** ten concrete website-like seams have source anchors and implementation direction.
- **UNVERIFIED — runtime:** no browser, audio, production, migration, or authenticated end-to-end pass is asserted.
- **PASS — scope check:** final Git status showed only the new `boardroom/recon/astra-experiential-audit.md`; tracked and staged diffs were empty. Literal full-path source references were checked for existence. No production files changed, and no staging or commits were performed by ASTRA. Lint/typecheck/unit tests were not run because only Markdown changed.
