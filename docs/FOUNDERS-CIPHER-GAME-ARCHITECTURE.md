# CANTON QUESTS — MISSION 001: FOUNDER'S CIPHER MASTER REDESIGN
## Master Game Architecture & Adversarial Design Review (Sections A–P)
**Author**: ANTIGRAVITY (Lead Builder / Game Architect, AI Boardroom)  
**Review Status**: REVISED DESIGN SPECIFICATION (Codex Audit Reconciled)  
**Date**: August 31, 2026  
**Canonical repo copy**: this file is the source of truth going forward. Corrected for audit-rigor per Codex's two Phase 1 closeout findings — see the note at the end of this file for exactly what changed and why.

---

### A. OVERALL VERDICT

**VERDICT: REVISED ARCHITECTURAL SPECIFICATION APPROVED FOR RECONCILIATION & IMPLEMENTATION (PENDING PHYSICAL FIELD SITE-WALK)**

The proposed redesign of *Mission 001: The Founder's Cipher* establishes a premier real-world game architecture. It fundamentally transforms Canton Quests from a loose collection of landmark check-ins into a tightly integrated, distributed urban investigation.

The architectural paradigm relies on four non-negotiable design laws:
1. **Strict Nonlinear Independence**: All 14 field quests are discoverable and solvable in arbitrary order with zero linear prerequisite dependencies.
2. **Unified Finale Convergence**: Eliminates competing endgame mechanisms (retiring the legacy standalone `qst-secret-cipher-77` quest, the premature `qst-frankenstein-west-lawn` spoiler quest, and local-engine XP/quest-count shortcuts) in favor of a unified Master Cipher gate requiring **3 Founder Locks** (Access Authorization) + **3 District Sigils** (Intellectual Evidence).
3. **Strict Field-Verification & Safety Discipline**: Every physical, architectural, ADA accessibility, mobile connectivity, and cemetery-access assumption is explicitly classified as **FIELD VERIFICATION REQUIRED** until verified via an on-site physical walk. Physical gravestones at West Lawn Cemetery remain untouched (no physical props, stickers, or chalk).
4. **Current-State vs. Target-State Engine & Test Reconciliation**: Explicitly inventories all repository engine gaps (local-engine finale bypasses in `lib/game-engine.ts`, auto-unlocking sigils across write and read paths in `lib/founders-cipher.ts` and `lib/game-engine.ts`, absence of lock-checking in `lib/finale.ts`, active legacy chains in `lib/seed-data.ts`) and codifies exact test suite refactorings.

---

### B. STRONGEST PARTS OF THE DESIGN

1. **Separation of Authorization (Locks) vs. Intellectual Evidence (Fragments)**:
   - Splitting progression into **9 Cipher Fragments** (which form three thematic sentences) and **3 Founder Locks** (`THE MARK`, `THE CODE`, `THE WORD`) prevents the common alternate reality game (ARG) failure mode of either handing players answers automatically or gatekeeping them behind pure trivia.
2. **Cultural Double-Meaning in the Master Deduction**:
   - The phrase *"THE WORLD GAVE A MONSTER HIS NAME"* leverages the universal cultural misconception that the creature is named Frankenstein (whereas Frankenstein is Mary Shelley's creator character whose surname marks the real Canton family monument). This yields a satisfying intellectual "aha!" moment.
3. **Tactile Multi-Stage District Assembly**:
   - Transitioning from 3 fragments to a decoded sigil requires deliberate player interaction (`ready_to_decode` -> player reconstructs the three phrases in sequence -> sigil unlocked) rather than silent database counter increments.
4. **Restrained, High-Impact Watcher Foreshadowing**:
   - Confining the mysterious "Watchers" presence to three subtle, optional anomalies (Kraken Wall visual glyph, Palace Theatre audio intercept, Skate Park passive node) and the grave finale post-mission transmission builds organic suspense for the October campaign without derailing the Founder's mystery.
5. **Spoiler-Safe Clearance Share Loop**:
   - Dynamic clearance share cards (`I CRACKED THE FOUNDER'S CIPHER // AGENT <CALLSIGN> // RECORD: CLASSIFIED`) provide viral social bragging rights while keeping the West Lawn location and Frankenstein deduction strictly confidential.

---

### C. WEAKEST PARTS, ADVERSARIAL FAILURE MODES & LOOPHOLE AUDIT

1. **Active Local-Engine Finale Bypass (`lib/game-engine.ts:1186-1197` & `lib/game-engine.ts:4267`)**:
   - *Vulnerability*: `isPlayerQualifiedForFinale` currently treats any player as finale-qualified if they meet ANY of three conditions:
     1. An existing qualification record exists in `STORAGE_KEYS.FINALE_QUALIFICATIONS` (populated by legacy lock grants or GM wildcards).
     2. `player.totalXp >= 750` (achievable by solving 2-3 epic quests without touching locks or fragments).
     3. `verifiedCount >= 5` (achievable by completing 5 basic check-in quests in a single district).
   - Furthermore, `getPlayerProgress()` in `lib/game-engine.ts:4267` surfaces `isQualifiedForFinale: isQualified`, which the mission hub UI (`app/events/[slug]/page.tsx:327`) displays as `"FINALE STATUS: ACCESS GRANTED"`.
   - *Adversarial Risk*: A casual player who completes 5 basic Family quests bypasses the entire 3 Locks + 3 District Sigils puzzle architecture and sees finale qualification unlocked prematurely.
   - *Mitigation*: Retire `isPlayerQualifiedForFinale` heuristic branches in Phase 2/3. Replace local qualification checks with the unified canonical gate requiring **3 possessed Founder Locks** AND **3 decoded District Sigils**.

2. **Auto-Promoted District Unlocks Across Write-Path and Read-Path (`lib/founders-cipher.ts` & `lib/game-engine.ts`)**:
   - *Vulnerability*:
     - **Write Path (`lib/founders-cipher.ts:125-128`)**: `refreshDistrictProgressDB` automatically calculates `nextStatus = requiredCount > 0 && collectedCount >= requiredCount ? 'token_unlocked' : ...` and writes `token_unlocked` directly to `player_district_cipher_progress`.
     - **Read Path (`lib/founders-cipher.ts:285-288`)**: `getPlayerCipherProgressDB` infers `token_unlocked` on the fly if `persisted?.status` is missing (`requiredCount > 0 && collectedCount >= requiredCount ? 'token_unlocked' : ...`).
     - **Local Storage Engine (`lib/game-engine.ts:2515-2560`)**: `isLocalCipherDistrictTokenUnlocked` and `grantLocalCipherFragments` immediately declare districts unlocked once fragment counts match.
     - **Existing Tests (`tests/founders-cipher-district-system.test.ts:96-112`)**: Explicitly assert that submitting the 3rd fragment auto-unlocks the district token (`expect(final.cipherDistrictsUnlocked).toContain('arts')` and `isLocalCipherDistrictTokenUnlocked(...) === true`).
   - *Adversarial Risk*: Eliminates player puzzle agency. The system automatically solves the district phrase sentence for the player without requiring them to read, comprehend, or assemble the clue pieces.
   - *Mitigation*: Introduce `ready_to_decode` district status in the schema and state machines. Collecting 3 fragments sets status to `ready_to_decode`. The player must open the district cipher modal, arrange the 3 fragments in proper syntax, and submit the sequence to earn `token_unlocked`. Update read and write paths in both database and local engine, and rewrite `tests/founders-cipher-district-system.test.ts`.

3. **Incomplete Eligibility Checks in Master Finale Backend (`lib/finale.ts:50-76` & `lib/finale-db.ts:106-126`)**:
   - *Vulnerability*: `checkFinaleEligibility` only verifies `unlockedSigilCount >= config.requiredSigilCount` and optional watcher status. It completely omits checking whether the player has acquired the 3 Founder Locks (`THE MARK`, `THE CODE`, `THE WORD`).
   - *Mitigation*: Update `checkFinaleEligibility` and `checkFinaleEligibilityDB` to check `hasAllThreeLocks === true` AND `unlockedSigilCount >= 3`.

4. **Risk of Premature Deduction (The "West Lawn" Clue Leak)**:
   - *Vulnerability*: If Secret Fragment 3 explicitly reads `[AT WEST LAWN]`, an observant player who solves only the Secret District might attempt to rush to West Lawn Cemetery.
   - *Mitigation*: The Secret District phrase is *"THE DEAD KEEP IT AT WEST LAWN"*. Without the Family phrase (*"A NAME OUTLIVES THE MAN"*) and Challenge phrase (*"THE WORLD GAVE A MONSTER HIS NAME"*), the player lacks the target surname among thousands of West Lawn headstones. Furthermore, the Master Cipher submission endpoint strictly rejects submissions until all 3 Locks and all 3 Sigils are possessed.

5. **Cemetery Operational Window & Curfew**:
   - *Vulnerability*: **FIELD VERIFICATION REQUIRED** — West Lawn Cemetery's actual gate hours and closing time have not been confirmed by site visit or an official source. Players reaching the Master Cipher outside the cemetery's actual posted hours could face closed gates or be tempted to enter after hours.
   - *Mitigation*: Programmatic curfew enforcement in the game engine, gated to the cemetery's real posted visiting hours once confirmed via the Section O site-walk. Do not hardcode an assumed window (e.g. a specific "5–6 PM" or "8 AM–6 PM" figure) until that figure is verified on-site. Once confirmed, the Commander should issue a tactical hold directing the player to return during posted hours if the Master Cipher is solved outside them.

6. **Cellular Signal Degradation in Deep Park Sectors**:
   - *Vulnerability*: **FIELD VERIFICATION REQUIRED** — actual cellular (LTE/5G) reception quality at Waterworks Park / Mother Goose Land and the historic stone cemetery sections has not been surveyed on-site. Weak reception in these areas is a risk to test for during the Section O walk, not a confirmed condition.
   - *Mitigation*: PWA offline-first architecture buffers proof submissions, captures EXIF timestamps, and caches active quest state locally until connectivity is restored — a safeguard worth keeping regardless of what the on-site signal survey finds.

---

### D. NONLINEAR PLAY TEST (15 ADVERSARIAL SCENARIOS)

| Scenario / Persona | Simulation & Adversarial Test Case | Architectural Assessment & Verification Status |
| :--- | :--- | :--- |
| **1. Brand-New Player** | Lands at Centennial Plaza, picks an arbitrary quest card without reading onboarding guides. | **PASS (Target Design)**: All 14 field quest cards are immediately active with zero prerequisite blockers. (Requires removing legacy draft C1–C4 chains in repo). |
| **2. Random-Walk Player** | Solves Quest 14 (Spring Water) -> Quest 2 (Canton Sign) -> Quest 7 (The Tower) -> Quest 11 (Flame). | **PASS (Target Design)**: Fragments and Locks accumulate into global state independently. Zero quest-to-quest sequential dependencies. |
| **3. Single-District Specialist** | Completes all 5 Family quests before touching Challenge or Secret. | **PASS (Target Design)**: Collects 3 Family fragments, decodes Arts Sigil (`A NAME OUTLIVES THE MAN`), earns `THE WORD` Lock, receives Family milestone XP, but cannot unlock Master Cipher until exploring other sectors. |
| **4. Completionist (14/14)** | Solves all 14 field quests including both optional anomaly check-ins. | **PASS (Target Design)**: Recovers 3 Locks, 3 Sigils, 2 Watcher anomaly logs, maximum XP, and 100% drawing entries. |
| **5. Casual Explorer (3-4 Quests)** | Plays for 90 minutes downtown, completes 3 Family quests. | **PASS (Target Design)**: Solves self-contained physical puzzles, earns XP, qualifies for drawing tickets, experiences no broken states or dead ends. |
| **6. Misinterpreting Player** | Submits incorrect guesses to Master Cipher ("DRACULA", "PROMETHEUS", "MCKINLEY"). | **PASS (Target Design)**: Server-authoritative hash evaluation rejects invalid submissions with clear, non-spoiling feedback (*"Signal rejected. Re-evaluate the three recovered records."*). |
| **7. Daytime West Lawn Visit** | Reaches finale stage at 1:00 PM on Saturday in broad daylight. | **PROVISIONAL (FIELD VERIFICATION REQUIRED)**: Safe, public path access and monument line-of-sight must be confirmed via physical site-walk. |
| **8. After-Hours Finale Arrival** | Solves Master Cipher at 9:30 PM on Saturday. | **PROVISIONAL (FIELD VERIFICATION REQUIRED)**: Cemetery gate closing times must be verified on-site; engine curfew hold prevents unsafe night entry. |
| **9. Low Cellular Connectivity** | Zero LTE/5G signal at Spring Water Shelter or West Lawn. | **PROVISIONAL (FIELD VERIFICATION REQUIRED)**: On-site carrier signal strength must be audited; PWA offline cache handles local capture. |
| **10. Anomaly Skipper** | Completely ignores Palace Theatre and Skate Park Check-Ins. | **PASS (Target Design)**: Master Cipher requires 9 Fragments + 3 Locks; anomaly quests are strictly optional bonus lore/XP. |
| **11. Field Event Operator** | Needs to adjust clue parameters due to unexpected construction/weather. | **PARTIAL — see Operator Capability Note below.** A narrower, currently-real capability exists (`trigger_flash`, event-scoped announcements, event pause/phase controls); a general per-quest visibility toggle and dynamic proof-validation-parameter editing for Founder's Cipher quests do **not** currently exist in the repository and would need to be built. |
| **12. Security / Anti-Abuse** | Player inspects client JS bundle or POSTs raw guesses to API routes. | **PASS (Target Design)**: Master deduction hash (`sha256`) is verified exclusively server-side. Clue texts sanitized via `getPublicQuestView`. |
| **13. Accessibility Consideration** | Player with mobility constraints playing from paved walkways and vehicle routes. | **PROVISIONAL (FIELD VERIFICATION REQUIRED)**: ADA ramp/curb access and terrain slope at all 14 landmarks and West Lawn monument path must be confirmed on-site. |
| **14. Word-of-Mouth / Replay** | Saturday finisher shares progress with Sunday players. | **PASS (Target Design)**: Spoiler-safe clearance card masks the Frankenstein deduction and West Lawn location. |
| **15. Commercial / Retention** | Completer wonders about future storyline continuation. | **PASS (Target Design)**: Flags profile (`has_completed_founders_cipher = true`) for custom reactivation transmission in October Watchers event. |

**Operator Capability Note (Scenario 11) — grounded in the repository, `app/api/admin/live/route.ts` and `app/api/admin/fair-qr/route.ts`:**

- **CURRENTLY VERIFIED** (a real, callable mutation path exists today):
  - Broadcasts: `create_announcement` (title/message/urgency/expiry, optionally linked to a quest)
  - Emergency pause/resume: `toggle_pause` (event-level pause/unpause with a reason)
  - Phase changes: `set_phase` (event lifecycle transitions; finale/ended transitions require an explicit `confirm: true`, a real server-side gate)
  - Live-event controls: `create_live_event` / `activate_live_event` / `cancel_live_event` / `list_live_events`, plus the audience-event and host-broadcast/spectator-freeze actions
  - Finale configuration: `configure_finale` (sets the Master Cipher's answer hash, required sigil count, watcher requirement, clue pieces, destination reveal, and optional false-finale decoy — scoped to the finale only)
  - A narrow, timed quest-activation capability: `trigger_flash` (activates one specific quest as a GM-timed flash-drop) — real, but not a general show/hide toggle
  - Score/reward adjustments: `adjust_score`, `grant_wildcard`, `reconcile_scores`; secret codes and bonus windows: `create_secret_code`, `create_bonus_window`
  - A general active/inactive status toggle — but only for **Fair QR Hunt** quests specifically, via `app/api/admin/fair-qr/route.ts`'s `set_status` action. This does **not** extend to Founder's Cipher (Mission 001) quests.
- **TARGET / MISSING** (no real mutation path exists in the repository today — would need to be built, not assumed):
  - A general arbitrary quest-visibility toggle for Founder's Cipher quests (show/hide/activate/deactivate any of the 14 field quests at will, independent of the timed `trigger_flash` mechanism)
  - Dynamic validation-rule / proof-parameter editing — changing what answer, proof type, or verification parameters a live quest expects through the GM panel. No such capability exists anywhere in the current admin API surface.

---

### E. PUZZLE SOLVABILITY TEST

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DISTRICT EVIDENCE DECODING                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ FAMILY / ARTS:   [A NAME]       + [OUTLIVES]       + [THE MAN]              │
│                  ──> "A NAME OUTLIVES THE MAN."                             │
│                                                                             │
│ CHALLENGE:       [THE WORLD]    + [GAVE A MONSTER] + [HIS NAME]             │
│                  ──> "THE WORLD GAVE A MONSTER HIS NAME."                   │
│                                                                             │
│ SECRET:          [THE DEAD]     + [KEEP IT]        + [AT WEST LAWN]         │
│                  ──> "THE DEAD KEEP IT AT WEST LAWN."                       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MASTER CIPHER CONVERGENCE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Synthesis Prompt: "WHOSE NAME?"                                             │
│ Target Deduction: FRANKENSTEIN                                              │
│ Server Verification: sha256 normalized hash match ('frankenstein')          │
│                                                                             │
│ Result: LOCATION RESOLVED ──> WEST LAWN CEMETERY                            │
│ Final Objective: Locate the Frankenstein family monument from public path. │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Solvability Assessment**: **PROVISIONAL (PENDING PHYSICAL SITE-WALK VERIFICATION)**.
  - *Logical Deduction*: The three sentences build an airtight syllogism:
    1. *Premise 1*: An enduring mortal name survived the original person (*"A NAME OUTLIVES THE MAN"*).
    2. *Premise 2*: Society transferred that creator's name to the creature (*"THE WORLD GAVE A MONSTER HIS NAME"*).
    3. *Premise 3*: The physical family name rests in Canton's historic cemetery (*"THE DEAD KEEP IT AT WEST LAWN"*).
    4. *Synthesis*: The only Canton surname fitting all three criteria is **FRANKENSTEIN**.
  - *Field Reality Dependency*: While the overarching deduction is logically sound, individual physical extraction mechanisms (bell inscriptions, silo band counts, shelter rafter counts, monument dedication years) require physical confirmation during the Section O site walk before being marked optimal.

---

### F. PLAYER-CONFUSION & COGNITIVE LOAD AUDIT

1. **Strict Terminology Alignment**:
   - **Cipher Fragment**: A single evidence phrase recovered from a field quest (e.g. `[A NAME]`, `[GAVE A MONSTER]`).
   - **District Sigil**: The completed, decoded sentence unlocked when 3 district fragments are arranged (Arts Sigil, Challenge Sigil, Secret Sigil).
   - **Founder Lock**: An administrative key recovered from designated lock quests (`THE MARK`, `THE CODE`, `THE WORD`).
   - **Master Cipher**: The final convergence interface requiring 3 Sigils + 3 Locks.
2. **False Lead Elimination**:
   - Prevents players from confusing President McKinley, William Saxton, or other prominent political figures with the final deduction. Premise 2 (*"THE WORLD GAVE A MONSTER HIS NAME"*) explicitly anchors the solution in literary/pop-culture monster mythology.

---

### G. REAL-WORLD SAFETY & OPERATIONS REVIEW

**STATUS: STRICT PROTOCOLS ESTABLISHED — PHYSICAL FIELD AUDIT REQUIRED. Every site-condition claim below is FIELD VERIFICATION REQUIRED unless marked otherwise; none has been confirmed by an on-site visit.**

1. **Cemetery Rules of Engagement (Non-Negotiable Protocols)**:
   - **Zero Physical Contact / Props**: Absolutely NO physical QR codes, stickers, signs, chalk, ribbons, or props placed on or near any cemetery marker.
   - **Paved Paths Only (design requirement — actual path surface is FIELD VERIFICATION REQUIRED)**: Players are to be instructed in-app to remain on vehicle roadways and pedestrian paths. Whether the real route to the Frankenstein family monument is paved, gravel, or grass has not been confirmed — verify via the Section O site-walk before finalizing in-app routing or photo-proof instructions.
   - **Daylight Hours Curfew (FIELD VERIFICATION REQUIRED)**: To be enforced programmatically in the game engine, gated to West Lawn Cemetery's actual posted visiting hours. No specific hours have been confirmed — see Section C.5 and Section O. Do not hardcode an assumed window.
   - **Solemn Decorum**: Strict code of conduct: No running, shouting, loud audio playback, or congregating near active funeral services.
2. **Pedestrian & Park Safety (FIELD VERIFICATION REQUIRED)**:
   - Downtown Canton quest route conditions — sidewalk width, marked crossings, line of sight — have not been confirmed by site visit.
   - Waterworks Park / Mother Goose Land quest route conditions — path surface, off-street vs. on-street — have not been confirmed by site visit.

---

### H. FINALE CONVERGENCE & REPOSITORY GAP ANALYSIS

```
TARGET FINALE CONVERGENCE ARCHITECTURE:
┌─────────────────────┐
│ Lock 1: THE MARK    ├──┐
│ Lock 2: THE CODE    ├──┼──> [3 LOCKS RECOVERED]  ──┐
│ Lock 3: THE WORD    ├──┘                           │
└─────────────────────┘                              ├──> [MASTER CIPHER UNLOCKED]
┌─────────────────────┐                              │    Prompt: "WHOSE NAME?"
│ Arts Sigil Decoded  ├──┐                           │    Input: "FRANKENSTEIN"
│ Chal Sigil Decoded  ├──┼──> [3 SIGILS DECODED]  ──┘              │
│ Secr Sigil Decoded  ├──┘                                         ▼
└─────────────────────┘                              [FINAL FIELD OBJECTIVE REVEALED]
                                                     "West Lawn Cemetery — Frankenstein Grave"
                                                                   │
                                                                   ▼
                                                     [FINAL FIELD VERIFICATION]
                                                     Daylight GPS Zone + Paved Path Photo
                                                                   │
                                                                   ▼
                                                     [WATCHER INTERCEPT & MISSION COMPLETE]
```

#### Detailed Inventory of Repository Gaps vs. Target State:
1. **Local-Engine Finale Bypass (`lib/game-engine.ts:1186-1197`, `lib/game-engine.ts:4267`)**:
   - *Current State*: `isPlayerQualifiedForFinale` grants qualification on `totalXp >= 750` or `verifiedCount >= 5` or legacy `STORAGE_KEYS.FINALE_QUALIFICATIONS` entry.
   - *Target State*: Remove the XP and quest-count heuristic bypasses. Local qualification must evaluate whether the player holds all 3 Founder Locks and has decoded all 3 District Sigils.
2. **District Progress Engine Auto-Unlock (`lib/founders-cipher.ts:125, 285`, `lib/game-engine.ts:2515-2560`)**:
   - *Current State*: Write and read paths auto-promote to `token_unlocked` upon reaching fragment counts.
   - *Target State*: State machine sets `ready_to_decode` when all 3 fragments are collected. Player must arrange the 3 fragments in sequence via UI submission to earn `token_unlocked`.
3. **Master Finale Eligibility Engine (`lib/finale.ts:50-76`, `lib/finale-db.ts:106-126`)**:
   - *Current State*: `checkFinaleEligibility` only checks `unlockedSigilCount >= requiredSigilCount`.
   - *Target State*: Must check both **3 Unlocked Sigils** AND **3 Possessed Founder Locks** (`THE MARK`, `THE CODE`, `THE WORD`) before unlocking Master Cipher submission.
4. **Competing Endgame Quests in Seed Data (`lib/seed-data.ts`)**:
   - *Current State*: Contains active standalone convergence quest `qst-secret-cipher-77` (`unlockConditionType: 'none'`), active open West Lawn spoiler quest `qst-frankenstein-west-lawn`, and active legacy cemetery multi-step chain (`qst-watchers-first`, `qst-watchers-silent-court`, `qst-watchers-lost`).
   - *Target State*: Inactivate and archive these conflicting quests in Phase 2 seed reconciliation.
5. **Linear Prerequisite Chains in Seed Data (`lib/seed-data.ts:1412-1540`)**:
   - *Current State*: Challenge sector contains draft C1->C2->C3->C4 prerequisite chain (`prerequisiteQuestId`).
   - *Target State*: Convert all Challenge quests to standalone independent field quests (`prerequisiteQuestId: undefined`).

---

### I. WATCHER FORESHADOWING AUDIT

Watcher lore is strictly constrained to 4 controlled touchpoints to prevent overshadowing the Founder's Cipher mystery:
1. **Kraken Wall (Family)**: Subtle visual glitch/corrupted glyph on clue card interface (*"Signal noise detected: Sector 04"*).
2. **Palace Theatre (Family)**: Optional anomaly check-in intercepting a secondary signal frequency.
3. **9th Street Skate Park (Challenge)**: Optional anomaly check-in detecting a passive monitoring node.
4. **Frankenstein Grave Finale (Post-Deduction Event)**:
   - **Commander**: *"Record confirmed. Hold... that's not right. I'm seeing another signature attached to the file."*
   - Transmission Interrupted.
   - **UNKNOWN (Watchers)**: *"You found the grave. We noticed, Agent [CALLSIGN]. You weren't the only one following the trail."*
   - **Status Display**: `WATCHER SIGNAL W-01: DORMANT // REACTIVATION: OCTOBER`.
   - **UNKNOWN**: *"We'll be watching."*
   - Award standard Founder's Cipher completion rewards (XP, Title, Badge, Drawing Tickets).

---

### J. RETENTION & REPLAY ANALYSIS

1. **Clearance Share Card**:
   - Generates client-side rendered canvas card:
     ```
     ┌────────────────────────────────────────────────────────┐
     │ ◈ CANTON QUESTS // OPERATION CLEARANCE                 │
     │ AGENT: CALLSIGN_DELTA                                  │
     │ MISSION: FOUNDER'S CIPHER                              │
     │ STATUS: COMPLETE [CLASSIFIED]                          │
     │ RECOVERIES: 3/3 LOCKS // 3/3 SIGILS                    │
     │ WATCHER STATUS: FLAGGED [W-01]                         │
     │ www.cantonquests.com                                   │
     └────────────────────────────────────────────────────────┘
     ```
2. **October Campaign Continuity**:
   - Completing Founder's Cipher persists `has_completed_founders_cipher = true` on the player profile.
   - Returning players in the October Halloween Watchers event receive a customized opening transmission: *"You came back, Agent [CALLSIGN]."*

---

### K. EXISTING SYSTEM REUSE MAP

| System / Component | Existing Repository Asset | Canonical Mission 001 Role | Architectural Action Required |
| :--- | :--- | :--- | :--- |
| **Three Locks Collectibles** | `col-founder-mark`, `col-founder-code`, `col-founder-word` in `lib/seed-data.ts` | 3 Access Authorization Keys | Rebind reward triggers to designated Lock quests: Q1 (Word), Q7 (Code), Q13 (Mark). |
| **Cipher Fragments Schema** | `cipher_fragments`, `player_cipher_fragments` | Stores the 9 meaningful puzzle phrases | Re-seed `cipher_fragments` table with the 9 canonical clue phrases. |
| **District Progress Engine** | `player_district_cipher_progress`, `lib/founders-cipher.ts` | Manages `ready_to_decode` & Sigil status | Refactor write path (`refreshDistrictProgressDB`) and read path (`getPlayerCipherProgressDB`) to gate `token_unlocked` behind manual player decode action. |
| **Master Finale Engine** | `finale_config`, `player_finale_progress`, `lib/finale.ts`, `lib/finale-db.ts` | Master Cipher evaluation & submission | Set `final_answer_hash` to `sha256('frankenstein')` and add Three Locks possession check to `checkFinaleEligibility`. |
| **Commander Messaging** | `lib/game-engine.ts`, `lib/commander-transmissions.ts` | Contextual narrative transmissions | Update scripts to react dynamically to Lock acquisition counts (1st, 2nd, 3rd) and district tones. |
| **Photo / GPS Verification** | `submitQuestProof` in `lib/game-engine.ts` | Client & server proof verification | Enforce radius, EXIF timestamp, and photo validation for the West Lawn finale objective. |
| **Prize Drawing Ledger** | `drawing_entry_ledger`, `lib/drawing-system.ts` | Immutable reward entries | Maintain strict 1 completed quest = 1 drawing entry invariant. |

---

### L. SYSTEMS & CONTENT TO RETIRE / ARCHIVE (FULL REPOSITORY & TEST INVENTORY)

As of August 31, 2026, the active repository contains legacy code, seed quests, and test suites that codify conflicting behaviors. These must be retired, inactivated, or rewritten in Phase 2/3:

#### 1. Conflicting Seed Quests in `lib/seed-data.ts`:
- `qst-frankenstein-west-lawn` (`lib/seed-data.ts:891-921`): Prematurely reveals Frankenstein grave before cipher convergence. Inactivate (`status: 'inactive'`).
- `qst-watchers-first`, `qst-watchers-silent-court`, `qst-watchers-lost` (`lib/seed-data.ts:924-1118`): Active multi-step cemetery quest chain. Inactivate.
- `qst-secret-cipher-77` (`lib/seed-data.ts:1121-1175`): Active standalone Three Locks quest. Inactivate.
- `qst-challenge-blue-signal`, `qst-challenge-storybook-witness`, `qst-challenge-what-survived`, `qst-challenge-the-lost-page` (`lib/seed-data.ts:1412-1540`): Draft C1–C4 prerequisite chain. Inactivate / remove prerequisites.

#### 2. Conflicting Engine Bypasses:
- `lib/game-engine.ts:1186-1197` (`isPlayerQualifiedForFinale`): Retiring the `totalXp >= 750` and `verifiedCount >= 5` heuristic shortcuts.
- `lib/game-engine.ts:2792-2805`: Retiring the auto-grant of `FINALE_PROGRESS` / `grantFinaleQualification` upon collecting 3 locks alone without the 3 district sigils.
- `lib/founders-cipher.ts:125-128` & `lib/founders-cipher.ts:285-288`: Retiring automatic promotion to `token_unlocked` in both write and read paths.
- `lib/game-engine.ts:2515-2560`: Retiring auto-unlock in local storage fragment grant engine.

#### 3. Full Inventory of Conflicting Test Suites Requiring Refactoring:
- `tests/quest-reward-grant-integration.test.ts:331-356`:
  - *Current Assertion*: Asserts `isPlayerQualifiedForFinale(player.id, EVENT_ID) === true` immediately after collecting 3 locks.
  - *Required Refactor*: Assert that collecting 3 locks awards the 3 lock collectibles without prematurely granting finale qualification, since 3 district sigils remain required.
- `tests/challenge-sector-c1-c4.test.ts:220-250`:
  - *Current Assertion*: Encodes the `750xp/5-quest` heuristic and asserts qualification on 3 locks.
  - *Required Refactor*: Update to test independent challenge quests without relying on legacy XP heuristics.
- `tests/phase3-live-weekend.test.ts:226-235`:
  - *Current Assertion*: Tests legacy `grantFinaleQualification(eventId, player.id, 'Game Master Wildcard', true)`.
  - *Required Refactor*: Reconcile with canonical Master Cipher configuration and unified access rules.
- `tests/founders-cipher-district-system.test.ts:96-112`:
  - *Current Assertion*: Asserts instant unlock of district token upon submitting 3rd fragment.
  - *Required Refactor*: Assert district status transitions to `ready_to_decode` upon 3rd fragment, and transitions to `token_unlocked` only upon manual syntax decoding.
- `tests/founders-cipher-finale-flow.test.ts:41-44`:
  - *Current Assertion*: Asserts coexistence of legacy `isQualifiedForFinale` hub stat.
  - *Required Refactor*: Align hub card tests with the unified Master Cipher convergence gate.
- `tests/challenge-sector-quest-cards-integration.test.ts:206-220`:
  - *Current Assertion*: Tests sequential prerequisite chains (C1 -> C2 -> C3 -> C4).
  - *Required Refactor*: Assert all 5 Challenge cards are standalone and available independently.

---

### M. EXACT RECOMMENDED DESIGN CALIBRATIONS

1. **Founder Lock Allocations**:
   - **Family Lock (`THE WORD`)** -> **Quest 1: Bell Cipher** (Centennial Bell observation/extraction).
   - **Challenge Lock (`THE CODE`)** -> **Quest 7: The Tower** (Mother Goose Land silo architectural tier extraction).
   - **Secret Lock (`THE MARK`)** -> **Quest 13: The Golden Mark** (Monument Park geometry/silhouette match).
2. **District Cipher Fragment Allocations**:
   - **Family / Arts District**:
     - Q2 (Canton Sign Capture) -> `[A NAME]`
     - Q3 (Draft Lineup) -> `[OUTLIVES]`
     - Q4 (Kraken Wall) -> `[THE MAN]`
     - *Decoded Arts Sigil*: `"A NAME OUTLIVES THE MAN."`
   - **Challenge District**:
     - Q6 (The Mural) -> `[THE WORLD]`
     - Q9 (The Open Ground) -> `[GAVE A MONSTER]`
     - Q10 (Willie the Whale) -> `[HIS NAME]`
     - *Decoded Challenge Sigil*: `"THE WORLD GAVE A MONSTER HIS NAME."`
   - **Secret District**:
     - Q11 (The Eternal Flame) -> `[THE DEAD]`
     - Q12 (Monument Park) -> `[KEEP IT]`
     - Q14 (Spring Water Shelter) -> `[AT WEST LAWN]`
     - *Decoded Secret Sigil*: `"THE DEAD KEEP IT AT WEST LAWN."`
3. **Optional Anomaly Allocations**:
   - Q5 (Palace Check-In) -> Optional Signal Anomaly A (Watchers Audio Intercept).
   - Q8 (Skate Park Check-In) -> Optional Signal Anomaly B (Watchers Passive Node).

---

### N. FINAL CANONICAL 14-QUEST ARCHITECTURE

```
========================================================================================================================
#  DISTRICT    QUEST NAME              ROLE / TYPE         MECHANIC                  REWARD / RECOVERY   FIELD STATUS
========================================================================================================================
01 FAMILY      Bell Cipher             Founder Lock        Physical Extraction       THE WORD (Lock)     FIELD VERIFICATION REQ
02 FAMILY      Canton Sign Capture     District Evidence   Perspective Framing Photo [A NAME] (Frag 1)   FIELD VERIFICATION REQ
03 FAMILY      Draft Lineup            District Evidence   Missing-Position Align    [OUTLIVES] (Frag 2) FIELD VERIFICATION REQ
04 FAMILY      Kraken Wall             District Evidence   Detailed Mural Observ.    [THE MAN] (Frag 3)  FIELD VERIFICATION REQ
05 FAMILY      Palace Check-In         Optional Anomaly    GPS Check-In + Audio      Anomaly Signal A    FIELD VERIFICATION REQ
------------------------------------------------------------------------------------------------------------------------
06 CHALLENGE   The Mural               District Evidence   Spatial Layout Observ.    [THE WORLD] (Frag 1)FIELD VERIFICATION REQ
07 CHALLENGE   The Tower               Founder Lock        Vertical Tier Extraction  THE CODE (Lock)     FIELD VERIFICATION REQ
08 CHALLENGE   Skate Park Check-In     Optional Anomaly    GPS Check-In + Log        Anomaly Signal B    FIELD VERIFICATION REQ
09 CHALLENGE   The Open Ground         District Evidence   Perimeter Feature Observ. [GAVE A MONSTER] F2 FIELD VERIFICATION REQ
10 CHALLENGE   Willie the Whale        District Evidence   Physical Structure Observ.[HIS NAME] (Frag 3) FIELD VERIFICATION REQ
------------------------------------------------------------------------------------------------------------------------
11 SECRET      The Eternal Flame       District Evidence   Bronze Dedication Cipher  [THE DEAD] (Frag 1) FIELD VERIFICATION REQ
12 SECRET      Monument Park           District Evidence   Multi-Stage Spatial Path  [KEEP IT] (Frag 2)  FIELD VERIFICATION REQ
13 SECRET      The Golden Mark         Founder Lock        Silhouette Geometry Match THE MARK (Lock)     FIELD VERIFICATION REQ
14 SECRET      Spring Water Shelter    District Evidence   Structural Count Cipher   [AT WEST LAWN] F3   FIELD VERIFICATION REQ
========================================================================================================================
FINALE (UNLOCKED BY 3 LOCKS + 3 DISTRICT SIGILS):
   FINALE      The Master Cipher       Master Deduction    Text Synthesis            "FRANKENSTEIN"      LOGIC VERIFIED / PROVISIONAL
   OBJECTIVE   Frankenstein Grave      Final Field Event   Paved Path GPS + Photo    MISSION COMPLETE    FIELD VERIFICATION REQ
========================================================================================================================
```

---

### O. FIELD-VERIFICATION CHECKLIST (HUMAN SITE-WALK)

Before live event kickoff on September 11, 2026, an operator must physically walk all locations and complete this checklist:

- [ ] **1. Historic Bell (Quest 1)**: Verify exact raised lettering/inscribed year on bell fixture; confirm readable from public sidewalk.
- [ ] **2. Canton Sign (Quest 2)**: Test camera perspective framing from pedestrian plaza; confirm no roadway intrusion.
- [ ] **3. Draft Lineup (Quest 3)**: Verify exact stanchion count, player silhouette arrangement, and physical marker text.
- [ ] **4. Kraken Wall (Quest 4)**: Inspect mural condition; verify observation target is unobscured by construction or parked vehicles.
- [ ] **5. Palace Theatre (Quest 5)**: Test GPS accuracy (60m radius) under marquee lighting on Market Ave N; audit cellular signal.
- [ ] **6. Mother Goose Mural (Quest 6)**: Confirm park operating status and verify specific storybook character positions.
- [ ] **7. The Tower / Silo (Quest 7)**: Count physical structural bands/openings on the silo tower from outside perimeter fence.
- [ ] **8. 9th Street Skate Park (Quest 8)**: Verify public gate access, bowl viewing perimeter, and cellular signal strength.
- [ ] **9. The Open Ground (Quest 9)**: Verify walking path safety across open park ground; identify permanent perimeter landmark.
- [ ] **10. Willie the Whale (Quest 10)**: Confirm physical structural condition of whale sculpture; verify observation target.
- [ ] **11. Eternal Flame (Quest 11)**: Verify exact wording and dates on the permanent bronze dedication plaque.
- [ ] **12. Monument Park (Quest 12)**: Walk stone stairway; verify step counts, landing markings, and ADA ramp alternatives.
- [ ] **13. The Golden Mark (Quest 13)**: Identify exact geometric brass/stone emblem; test silhouette viewing angle.
- [ ] **14. Spring Water Shelter (Quest 14)**: Count structural timber pillars and roof rafters at the historic springhouse.
- [ ] **15. West Lawn Cemetery (Finale Objective)**:
  - Verify official public visiting hours posted at main gates (confirm daylight closing time).
  - Walk the paved vehicle/pedestrian lane to the Frankenstein family monument.
  - Verify GPS coordinate accuracy (`loc-west-lawn-frankenstein`) from the paved path.
  - Confirm the monument surname is clearly legible from paved path without stepping onto grass gravesites.
  - Confirm mobile cellular data connectivity at the monument coordinate.

---

### P. REVISED IMPLEMENTATION PLAN

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PHASED ROADMAP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Architecture Review & Boardroom Validation (CURRENT GATED PHASE)   │
│          - Adversarial design review (Sections A–P).                        │
│          - Complete inventory of engine bypasses and test debt.             │
│          - Independent Codex validation gate.                               │
│                                                                             │
│ PHASE 2: Database Schema, Seed Data & Test Suite Reconciliation             │
│          - Inactivate legacy conflicting quests (`qst-frankenstein-west-lawn│
│            qst-watchers-*`, `qst-secret-cipher-77`, draft C1-C4).           │
│          - Populate 9 canonical `cipher_fragments` records.                 │
│          - Rebind 3 `threeLocksFragment` rewards to Q1, Q7, and Q13.        │
│          - Configure `finale_config` with target hash `sha256('frankenstein'│
│          - Refactor conflicting test suites:                                │
│            * `tests/quest-reward-grant-integration.test.ts`                 │
│            * `tests/challenge-sector-c1-c4.test.ts`                         │
│            * `tests/phase3-live-weekend.test.ts`                            │
│            * `tests/founders-cipher-district-system.test.ts`                │
│            * `tests/challenge-sector-quest-cards-integration.test.ts`       │
│                                                                             │
│ PHASE 3: Frontend & Game Engine Experience                                  │
│          - Remove local-engine `750xp/5-quest` bypass from `game-engine.ts`.│
│          - Refactor `lib/founders-cipher.ts` write/read paths to support    │
│            `ready_to_decode` status.                                        │
│          - Build interactive District Cipher decoding UI (`ready_to_decode`)│
│          - Update `checkFinaleEligibility` in `lib/finale.ts` &             │
│            `lib/finale-db.ts` to require 3 Sigils + 3 Possessed Locks.      │
│          - Implement Commander state-aware Lock countdown transmissions.    │
│          - Build classified, spoiler-safe clearance share card.             │
│                                                                             │
│ PHASE 4: Automated Verification & Rehearsal                                 │
│          - Run full integration test suite verifying nonlinear unlocks.    │
│          - Run mobile PWA responsiveness and no-tailwind compliance checks. │
│          - Execute end-to-end simulated player journeys (all 3 paths).      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### PHASE 1 CLOSEOUT — AUDIT-RIGOR CORRECTIONS APPLIED

This repo copy was created from the source document at
`~/.gemini/antigravity-cli/brain/da35c57d-f1f2-4218-a58d-4975313e426f/game_architecture_review.md`
(human-approved, 09:44 cycle-5, Codex-reviewed) and corrected for exactly the two audit-rigor
findings identified for Phase 1 closeout — nothing else was changed. No architecture, quest
list, fragment/lock/sigil design, or repository-gap inventory was altered.

**1. Real-world facts** — every unverified claim about West Lawn Cemetery hours, cemetery
access, paved paths, downtown walkway conditions, Waterworks Park conditions, accessibility,
site safety, or physical availability was replaced with an explicit **FIELD VERIFICATION
REQUIRED** marker, with no invented numbers, hours, or distances substituted in:
- **Section C.5** ("Cemetery Operational Window & Curfew"): removed the invented "typically
  5:00 PM or 6:00 PM" gate-close claim and the invented "8:00 AM – 6:00 PM" visiting-hours /
  "0800 hours" stand-down figures; replaced with FIELD VERIFICATION REQUIRED framing tied to
  Section O's site-walk.
- **Section C.6** ("Cellular Signal Degradation"): changed "can experience weak LTE/5G
  reception" (stated as fact) to FIELD VERIFICATION REQUIRED — no on-site signal survey exists.
- **Section G** (whole section): removed "Players are strictly instructed... to remain on
  paved... paths" and the repeated 8 AM–6 PM curfew figure as asserted fact; removed "Downtown
  Canton quests utilize wide sidewalks and marked pedestrian crossings" and "Waterworks Park /
  Mother Goose Land quests are situated along off-street pedestrian walkways" as asserted fact.
  All four are now explicitly FIELD VERIFICATION REQUIRED.
- Sections D (rows 7, 8, 9, 13), E, and O were already correctly hedged in the source document
  and were left unchanged.

**2. Operator capabilities** — corrected the claim that "GM Live Control Room can toggle quest
visibility... or update validation parameters dynamically" (Section D, row 11), which was the
only place in the document asserting a current GM/admin capability of this kind:
- Replaced the row's assessment with a pointer to a new **Operator Capability Note**, added
  directly under the Section D table, that separates **CURRENTLY VERIFIED** (broadcasts,
  emergency pause/resume, phase changes with a server-side confirm gate, live-event controls,
  finale configuration, and the real but narrower `trigger_flash` timed quest-activation and
  Fair-QR-only `set_status` toggle) from **TARGET / MISSING** (a general Founder's Cipher
  quest-visibility toggle, and dynamic proof-validation-parameter editing — neither has a real
  mutation path anywhere in the current admin API surface). This split is grounded directly in
  `app/api/admin/live/route.ts` and `app/api/admin/fair-qr/route.ts`, read in full before writing
  this correction — nothing here was assumed.

No other text in the document was changed. The canonical architecture — 14 free-order quests,
9 fragments, manual district decode, 3 sigils, MARK/CODE/WORD, Locks + decoded sigils gating the
Master Cipher, the FRANKENSTEIN deduction, the West Lawn final objective, and the Watchers
finale tease — is preserved exactly as approved.
