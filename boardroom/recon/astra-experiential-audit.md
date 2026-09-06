# Canton Quests experiential audit — CQ Field Protocol

Phase 1 · Astra · Boardroom review document · 2026-09-06

**Recommendation:** build Phase 2 and Phase 3 on **CQ Field Protocol**: one recognizable field instrument that receives an objective, accepts evidence, confirms the result, and leaves a durable record. Canton supplies the spectacle; the interface makes discovery legible. Preserve the existing artwork, Commander, doors, and reward systems. Give their surrounding interactions the same discipline.

This is a proposed interaction architecture, not an accepted change to gameplay or authorization to implement. Only this document is delivered. Boardroom owns staging and commits.

## 1. Evidence, scope, and confidence

Baseline inspected: `b3cf6a4`. The working tree and index were clean at the initial inspection. Sources are the current routes, rendered JSX branches, component callbacks, presentation managers, types, and finale decision logic—not an assumed linear funnel from older design documents.

**HIGH_CONFIDENCE — source walkthrough:** the routes and state transitions below were traced in this checkout. Visual judgments describe what the current structure, copy, controls, and effects imply. **PARTIAL — experiential verification:** no authenticated browser session, physical scan, GPS walk, video listening session, production configuration check, or rendered mobile contrast/performance measurement was performed. No local application server was listening at inspection. This is not a claim that every branch is available to a production player today. In particular, future event windows, protected progress, and configured finale content cannot be established from component existence.

Read first: `PROJECT-BRAIN.md`, `boardroom/BOARDROOM.md`, `GAME-SYSTEM.md`, `TECH-ARCHITECTURE.md`, `DATABASE.md`, `SAFETY-AND-RULES.md`, `BRAND.md`, `PLAYER-JOURNEY.md`, relevant `DECISIONS.md` entries, and the repository UX/game-system guidance. The supplied task authorizes this Phase 1 document despite the Boardroom constitution's older statement that the overhaul has not started.

Precedence and drift to carry into later work:

- The current user instructions require CQ-prefixed custom CSS and prohibit introducing Tailwind. This checkout nevertheless contains Tailwind dependencies/imports and utility-heavy JSX, and `TECH-ARCHITECTURE.md` describes them. Record the discrepancy; new work follows the explicit custom-CSS instruction. Do not remove the existing CSS pipeline as an incidental cleanup.
- Older journey/game/safety documents describe teams, promised sensors, and future mechanics. `PROJECT-BRAIN.md` and ADR-023 establish individual competition. Do not turn those older descriptions into implemented-feature claims.
- `lib/path-tone.ts` and current entry logic treat the selected path as universal communication style. Some rules/shell copy still describes Mission-specific or geographic paths. Preserve the current authoritative behavior; reconcile explanatory copy in a separately scoped task. A path must not restrict quest access or alter rewards.
- A safety statement in a document is not proof that its enforcement exists. No new destination, physical checkpoint, operating hour, countdown, prize amount, or public safety guarantee is introduced here.

All source paths below are relative to the repository root. Function names and exact copy are search anchors for implementers.

## 2. The real journey is a set of branches

```text
Homepage / discovery landing / physical QR / bookmarked quest
   ├─ Register or log in → confirmation/recovery if needed → preserved next URL
   ├─ Path selection where requested → save → Player File or Mission
   └─ Returning player → existing identity and participation

Mission entry → lifecycle/auth/participation/path gates → Cold Open + briefing
   → Mission Board ↔ Map / Scores / Collectibles / Rules
   → quest detail → observe city → enter proof → checking
       ├─ retry / unavailable / pending review
       └─ verified step or quest → actual rewards → next objective
           ├─ district fragments → manual decode → district Sigil
           └─ Founder Locks: THE MARK / THE CODE / THE WORD
                    ↓
       Master Cipher eligibility → convergence → optional configured false finale
          → solved record + configured reveal

Alongside play: Transmissions / Player File / Watch Live / Drawing
After the event: results, archive, persistent identity; no replayed first-time awards
```

The arrows describe navigation and conditional progression, not additional mechanics. Drawing qualification and Master Cipher access are different systems. The three district decodes are independent; their order must remain open.

### Surface-by-surface walkthrough

| Surface and actual source | Current player experience and transition | Assessment and direction |
|---|---|---|
| **1. Homepage** — `app/page.tsx`, `CinematicNav`, `OperationCard`, `MobileStartBar` | Reads `/api/auth/me`, event listings, roster, and global XP leaderboard. Anonymous players get registration/login; returning players get identity and Player File access. Active/upcoming/past Missions, explanatory sections, promo video, standings, roster, and final CTA follow. | Strong city/identity framing, but repeated sections and CTAs read as a promotional website. Keep discovery content; make the returning player's current Mission and next action the first useful instrument readout. Do not call a global XP total a Mission score. |
| **2. Discovery landings** — `app/start/{family,challenge,secret}/page.tsx`, `components/landing/*Landing.tsx` | Path-themed landings embed `FastPlayerOnboardForm`; Family explicitly supplies `startingPath="family"` and redirects to `/profile`. They are another entry path, not just links to the homepage. | Retain path artwork and acquisition attribution. The saved identity must carry through to Player File and subsequent Mission entry without another apparent enrollment ceremony. Inspect each landing's redirect when implementing. |
| **3. Registration and path selection** — `app/register/page.tsx`, `ThreePathSelector.tsx` | Registration resolves `next` against an event or QR lookup, then chooses the door flow or `CreatePlayerIdentityPanel`. Selecting a door sets local state, emits `path-lock`, scrolls the form into view, and focuses its first empty field. | The doors are distinctive. The confirmation currently overstates a local selection as a lock. Use an inline preview until the server saves the choice; reserve the lock ceremony for persistence. Retain keyboard selection and reduced-motion scroll behavior. |
| **4. Identity, confirmation, login, recovery** — `FastPlayerOnboardForm.tsx`, `CreatePlayerIdentityPanel.tsx`, `app/auth/login/page.tsx`, `app/auth/{confirm,forgot-password,reset-password}/page.tsx`; `/login` re-exports auth login | Registration submits to `/api/auth/register`; confirmation-required and immediate-session branches differ. Fast onboarding also supports password/OTP flows. Immediate-session path registration can emit another `path-lock` before navigating. | The form should feel like receiving a Player Identity while keeping ordinary field labels and recovery instructions. “Email confirmation required” is a real pause, not “identity issued.” Preserve `next`, password-manager behavior, validation, consent, and recoverability. Never delay a usable account behind a timer. |
| **5. Player File and return** — `app/profile/page.tsx`, `PlayerCard`, `PlayerAvatar`, `lib/player-file-nav.ts` | `/api/player/command-center` supplies identity, badges, chosen path, and bonuses. Profile/avatar actions have their own save requests and feedback. The canonical card is already the strongest issued-object metaphor. | Preserve artwork, avatar resolver, six featured badge slots, and existing reward contracts. Distinguish saved identity from editable settings. Route back to a real Mission explicitly; do not let account maintenance become an obligatory detour before every quest. |
| **6. Mission entry and lifecycle** — `app/events/[slug]/page.tsx`: `enterOperation`, entry effects, loading and gate branches; `FounderCipherShell.tsx` | Auth check leads to idempotent participation entry. Event loading has a timeout/error/retry path. Upcoming, active, finale, ended, auth, and missing-path branches differ. On first qualifying entry, Cold Open queues `MISSION_BRIEFING`; missing-path flow can also queue Three Doors and saved-path messaging. | This is the main transition from site to equipment. Preserve all gates and one-time delivery. Arrival must resolve to one visible objective. “Upcoming” is not network failure; signed-in identity is not proof of every downstream eligibility condition. |
| **7. Mission hub / Board** — same event page; `FounderCipherShell`, `QuestCard`, `CityPulseStrip`, `LiveCityStatusPanel` | The shell retains hero, briefing, prize and door sections; dashboard children and Mission links coexist with them. Hub includes passcode entry, identity, fragment panel, Master Cipher status, recommendation, stats, tabs, and quest cards. `/events/[slug]/quests` redirects to `?tab=quests`. | The repeat marketing content interrupts field use. Retain it in overview/discovery context; make active/resumed Board navigation land on the task region with context intact. Keep the existing single hub, redirects, tab model, and cards rather than building a second dashboard. |
| **8. Map, rankings, inventory, rules** — event-page tab branches; `CantonMapWrapper`, `SectorMapWrapper`, `Leaderboard`; scoped redirect pages; `app/leaderboard/page.tsx` | Map redirects to `?tab=map`; scoped leaderboard redirects to `/leaderboard?operation=...`. Dashboard scores and the standalone ranking page are distinct views. Collectibles display names, descriptions, and sources; rules provide field guidance. | Present these as instruments within the same Mission. Keep event identity visible when routes change. Use actual available map data; never animate a fabricated GPS fix. Remove development vocabulary such as “Phase 3 Cipher Collection” from later player copy. |
| **9. Quest detail / instruction** — `app/events/[slug]/quests/[questId]/page.tsx` | Canonical artwork, reward badges, title, description, “Go here / Do this / Rewards,” directions, transmissions, and access/safety information precede verification. Standalone quest artwork has a dedicated contained portrait treatment. | Preserve the physical quest card as the issued object. Make the next required action and access constraints easy to reach. Keep standalone art contained, with explicit dimensions in later CSS work; do not crop or reproduce it as a new card system. |
| **10. Field proof / quest loop** — quest detail `handleSubmit`; `LocationVerifier.tsx`; `/api/game/submit` | Text/code, GPS/check-in, media/manual-review, and multi-step branches differ. GPS is requested on verifier mount; local proximity guides the player, while server submission decides progress. Media/manual proof uses a text field for a link/details, with a camera-style decorative area. Pending review is a separate state. | One proof instrument with explicit modes, not a generic “Submit Proof Verification” form. Label the implemented link input honestly. Permission, outside-radius, server rejection, pending review, partial step, and completed quest must each produce different feedback. No simulated scanner or invented upload capability. |
| **11. Reward receipt and next quest** — quest-detail submit/poll callbacks; `lib/game-effects.ts`; `GameFeedbackModal.tsx`; `components/game-effects/*` | Server results drive reward sequences, XP/entry moments, unlocks, Founder messages, and some legacy feedback modals. Pending approvals can resolve through refresh/polling. Different branches can produce different stacks of presentation. | Preserve all grants; coordinate their presentation. One verified action should yield one concise receipt plus at most one major story beat. Put the next playable objective on that receipt. A step accepted is not a quest completed; submission accepted is not reward issued. |
| **12. Commander channel and replay** — `CommanderTransmissionEffect`, `CommanderTextTransmission`, `WatchTransmissionButton`; scoped transmission archive/player; `lib/commander-transmissions.ts` | Video registry contains 15 entries. Archive fetch returns revealed videos; text Field Log reads a client-side message log. Player fetch checks access and preserves a sanitized `returnTo`. Video/text moments do not auto-dismiss by default; video ignores backdrop dismissal. | This is already a coherent channel worth extending. Keep Cold Open at entry, not as a static Mission-home Cold Open card. Preserve the separate public promotional briefing. Archive and moment playback should share framing, controls, return language, and honest load errors. Client text history is not a cross-device delivery guarantee. |
| **13. District fragments and decode** — `CipherFragmentsPanel.tsx`, `lib/founders-cipher.ts`, hub/finale call sites | Collected/obscured fragment rows lead to `ready_to_decode`. Three collected phrase tiles are reordered with Up/Down controls; `/api/game/cipher/decode` confirms or rejects. Success shows decoded text and closes the panel after 2.5 seconds. | This is an actual manipulation task, suited to a decoder rather than a progress checklist. Keep button-based ordering; animate only the moved tile. Keep the successful sentence readable until explicit Continue. Hub currently only refreshes after decode; finale also emits a Commander message—align the presentation contract. |
| **14. Founder Lock recovery** — quest detail `threeLocksFragmentAwarded` / `threeLocksOwned`; `ThreeLocksFragmentEffect.tsx`; Founder message resolver | THE MARK, THE CODE, THE WORD are recovered through real quest rewards. Shared effect supports single-lock and all-locks states; current Cipher branches also use contextual Commander text. There is no separate Founder Lock route to invent. | Make each recovered lock visibly seat into a three-slot ownership record. Keep lock identity distinct from district phrase fragments and district Sigils. All locks authorize one requirement of convergence; they do not alone prove Master Cipher readiness. |
| **15. Master Cipher and finale** — `MasterCipherStatusCard.tsx`, `app/events/[slug]/finale/page.tsx`, `lib/finale.ts` | Hub card has Locked/Ready/Solved. Finale checks configuration, event/window, all three locks, configured Sigil count, optional Watcher eligibility. Ready view displays clue pieces and solution input. Wrong and false-finale outcomes are inline; completion queues `FINAL_SOLUTION_CORRECT` then `MISSION_COMPLETE`, and shows saved reveal. | The state model is good; the peak interaction still resembles a text submission form. Use a convergence instrument around the existing input and authority. Keep false finale conditional, avoid prematurely celebrating it as completion, and preserve the durable solved screen on revisit. |
| **16. Drawing, live audience, post-event** — `app/events/[slug]/drawing/page.tsx`; `/watch` and scoped watch redirect; shell ended branch; profile and archive | Drawing fetches its event projection and has pending/in-progress/winner states. Watch redirects with `eventSlug`. Ended shell links to final standings, prize results, archive. Persistent identity remains available. | Drawing is a transparent prize record; Master Cipher is a narrative solve. Keep both discoverable and clearly named. Watch is an optional audience surface, never an invented prerequisite. End on what the player actually earned and what the server has published. |
| **17. Physical QR / Fair alternate entry** — `app/qr/[code]/page.tsx`, registration QR lookup, Fair event route | QR page resolves authentication and conditionally calls `/api/qr/claim`; result branches include first finder, previous claim, lifecycle unavailability, and signal offline. Registration lookup prevents an unrelated Cipher path flow for path-free Fair entry. | Deep links must preserve the scanned destination through auth. Keep existing QR identifiers and Fair behavior. Shared feedback grammar applies, but Cipher doors, locks, fragments, archive, and finale must never appear merely because a generic component is reused. |

## 3. Specific breaks in the equipment illusion

These are source-grounded findings, not measured browser defects. Priority describes experiential impact: **P1** affects comprehension/trust or the core loop; **P2** affects continuity/polish.

| ID | Current moment and evidence | Why it reads as a generic website or undermines the instrument | Concrete direction |
|---|---|---|---|
| G1 · P1 | `FounderCipherShell` retains promotional hero, briefing, prize callout and doors around working dashboard content. | Returning to a tool feels like visiting its sales page again. | Distinguish overview from field use within existing route/tab behavior; resume at the working objective. Keep promotional media discoverable. |
| G2 · P1 | `ThreePathSelector.handleSelect` emits `path-lock` on local selection; `FastPlayerOnboardForm` can emit it again after registration. | A decorative success modal precedes persistence, then repeats. | Local door = **Selected**. Successful server save = **Path saved** and one Issue ceremony. Failure returns to editable choice with its real error. |
| G3 · P1 | Quest detail heading “Submit Proof Verification”; photo/video branch has a text field and camera-styled `div` without an attachment handler. | Back-office form wording and a false upload affordance interrupt field action. | Use “Send proof” with “Paste proof link” for current capability. Actual capture/upload would require a separately scoped functional task. |
| G4 · P1 | `CipherFragmentsPanel` displays rows/progress bars, then auto-closes decoded sentence after 2500 ms. | Collection reads as a checklist and its earned story becomes a transient toast. | Reorder in a stable decoder tray, verify, seat the Sigil, retain sentence with Continue and durable district record. |
| G5 · P1 | Finale ready state uses “Submit Your Solution,” an input, and “SUBMIT.” | The narrative peak uses the same visual grammar as an ordinary contact form. | Preserve the input, add an intelligible convergence frame showing actual locks/Sigils and one “Verify solution” action. Reveal only after server completion. |
| G6 · P1 | Hub legacy “Finale Status” derives qualification from completed quests; `MasterCipherStatusCard` separately uses real finale eligibility. | Two different meanings of “finale” make progress feel arbitrary. | Label the legacy statistic as drawing qualification only after confirming its exact data semantics; label Master Cipher Locked/Ready/Solved separately. Never map one into the other. |
| G7 · P1 | Archive fetch failure becomes `[]`; transmission-player fetch failure becomes `locked`. | A website empty-state fallback disguises a connection fault as lost progress. | Add an unavailable/retry presentation distinct from a legitimate empty or locked response, preserving privacy of unrevealed entries. |
| G8 · P2 | `GameFeedbackModal` has bouncing emoji, a generic glow card, and the static eyebrow “MISSION VERIFIED & COMPLETED” across its supported feedback types. | Celebration vocabulary is detached from the actual event and competes with the shared cinematic overlay. | Route existing callers through one receipt grammar; choose label from the real event. Do not assume every remaining caller is redundant without checking it. |
| G9 · P2 | Header, `CinematicNav`, hub tabs and shell links use Mission Board, Missions, Rankings, Scores and Command Center in differing contexts. | Navigation feels like several applications joined by links. | Keep destinations; standardize visible labels and preserve Mission context across shared routes. |
| G10 · P2 | Drawing loading copy says “Loading authoritative drawing ledger projection...”; inventory says “Phase 3 Cipher Collection.” | Implementation and project-management language leaks into player equipment. | “Loading drawing record…” and “Collectibles”; preserve full transparency details where they help players understand awards. |
| G11 · P1 | `LocationVerifier` plays `lock_on` when coordinates arrive, before its proximity result; it requests permission on mount. | Sensor acquisition can sound like objective verification, with permission requested before a clear explanation. | Distinguish **Location found**, **Outside radius**, **Ready to submit**, and **Verified**. Explain location need before permission when this flow is revised; keep server validation authoritative. |
| G12 · P2 | Profile presents the canonical Player Card alongside bonuses and a long “Profile Settings” form; homepage repeats broad recruitment content for return journeys. | The issued identity loses hierarchy to account administration. | Lead with the saved card and active Mission continuation; keep editable fields and bonuses accessible below. No new avatar, card, or reward system. |

What already works: city-specific artwork; the three doors; the canonical Player Card; practical “Go here / Do this / Rewards”; contained quest art; a central moment queue; manual video replay; protected archive projection; independent district decode; server-derived finale states. Phase 2 should connect these strengths, not erase them.

## 4. Unified language: CQ Field Protocol

### 4.1 Design premise and alternatives

Three approaches were considered:

1. **Film-first interface:** full-screen transitions and Commander beats between most actions. Strong spectacle, but slows repeated field use and competes with permission prompts and evidence entry.
2. **Dashboard-first interface:** standard cards/forms with uniform colors. Efficient, but leaves the central product identity dependent on decorative backgrounds.
3. **Field instrument with earned ceremonies — recommended:** a quiet, consistent operational surface; brief tactile feedback for routine work; deliberate reveals only when the game state earns them. Reuses the current managers and components with the smallest conceptual change.

The player-facing metaphor is issued civic adventure equipment, not a military simulation. Avoid camouflage, aggression, fake security guarantees, terminal gibberish, random coordinates, and invented “clearance levels.” The Commander can be mysterious; instructions, account recovery, errors, and safety must be plain.

### 4.2 Core vocabulary and naming

| Term | Meaning and example | Existing implementation home |
|---|---|---|
| **Mission** | The selected event context, identified by its real title. Keep existing public Mission naming; code still uses event/operation identifiers. | Event hub, `Header`, `FounderCipherShell` |
| **Mission Board** | The place to choose a Quest. A **Quest** is the challenge; **Step** is one objective inside it. Avoid renaming the whole system during polish. | Hub quests tab, `QuestCard`, quest detail |
| **Player File** | Persistent identity and earned record. “Save profile” remains a clear control inside it. | Profile, `PlayerCard`, `PlayerAvatar` |
| **Instrument** | Internal design term for a task area: map, proof control, decoder, or record. Do not add this word to every player heading. | Existing map wrappers, verifier, fragment panel |
| **Signal** | A received clue/update or real sensor status, qualified in copy: “Location found” versus “Fragment recovered.” Not a universal replacement for error or score. | City status, QR results, fragment panel |
| **Transmission / Field Log** | Commander content and its replay history. “Replay transmission,” “Return to quest.” Field Log is currently local text history. | Existing Commander components and scoped archive |
| **Fragment / Sigil / Founder Lock** | Fragment = collected district phrase; Sigil = decoded district result; Founder Lock = THE MARK, THE CODE, or THE WORD. Never interchangeable. | Cipher panel, lock effect, finale status |
| **Receipt** | Internal design term for a server-confirmed result containing actual changes and next action. Player title: “Quest verified,” “Step accepted,” or “Proof received.” | Existing reward moments and submit result |
| **Drawing entry** | Event-specific prize eligibility unit. Keep “Entry Token” where the established reward artwork uses it, with “drawing entry” explanation. Never substitute XP or narrative access. | Reward components, drawing page |
| **Master Cipher** | The convergence challenge. **Finale** can describe the broader closing experience, but cannot stand in for drawing qualification. | Status card, finale route |

Control grammar: **verb + object**. Use “Open quest,” “Check location,” “Send proof,” “Verify code,” “Decode district,” “Verify solution,” “Replay transmission,” “Return to Mission Board.” One dominant action per task area. Preserve familiar input labels such as Email and Password; no cipher-themed password-entry gimmicks.

Implementation names proposed for Phase 2: `.cq-field-*` for shared surfaces and `.cq-motion-*` for reusable motion treatments. Semantic values use `--cq-field-*` aliases. These are proposed CSS vocabulary, not new files/classes already present. Existing `GameMoment.type`, API fields, registry IDs, QR codes, and message IDs remain unchanged. Add a new semantic key only when a real caller needs it.

### 4.3 HUD structure and state grammar

Every instrument has the same reading order: **context → state → objective/content → primary action → recent result**. Use a quiet Mission/callsign header, readable task title, explicit status label, and stable place for errors/results. On a phone, these should not require a large hero scroll to reach. Keep the primary action above the safe-area inset and clear of the keyboard; no stacked competing sticky bars.

| HUD state | Meaning, copy example, and visual behavior | Authority / action |
|---|---|---|
| **Checking** | “Checking Mission status…”; static frame with one optional acquisition sweep. | Active request; no fabricated progress percentage or success sound. |
| **Available** | “Quest available”; neutral frame, amber action. | Existing sanitized quest availability. Open quest. |
| **Selected** | “Secret selected — save to continue”; path edge accent only. | Local preview. Save or change selection. |
| **Locked** | Lock icon plus actual reason; e.g. “Founder Locks required.” | Server eligibility/projection. Offer a relevant route; no implied permission from CSS state. |
| **Ready** | “Ready to decode”; clear action and nonanimated emphasis. | Required collection/eligibility confirmed. Begin allowed action. |
| **Sending / Verifying** | “Sending proof…” / “Checking code…”; disable duplicate submission, keep input and layout stable. | In-flight request. No grant or solve claims. |
| **Pending review** | “Proof received — awaiting review”; amber waiting state with receipt context. | Server pending submission. Return to Board; do not show earned XP. |
| **Verified / Recovered / Solved** | Check icon, readable factual label, earned values; single Seat motion. | Specific successful server result. Persisted result remains visible after ceremony. |
| **Retry** | “Code not recognized. Check it and try again.” Keep supplied input unless existing semantics require clearing it. | Validation rejection. Associate error with input; never shame the player. |
| **Unavailable** | “Connection interrupted. Retry.” Keep last known data marked as such where available. | Transport/load failure. Never relabel as locked, empty, upcoming, or solved. |
| **Upcoming / Paused / Closed / Archived** | State and real event timing/reason in text. Paused only when the actual surface supplies it. | Existing lifecycle data. No fake ticking urgency or extra client-computed eligibility. |

“Ready to submit” after local GPS checks is an affordance; “Verified” belongs to the server response. A completed quest, decoded district, all-locks collection, drawing qualification, and solved Master Cipher retain separate records and labels.

### 4.4 Motion vocabulary

Motion communicates cause, spatial continuity, or an earned change. The following values are Phase 2 defaults to implement and measure, not measured properties of the current application.

| Named motion | Timing / geometry | Concrete use | Reduced motion |
|---|---|---|---|
| **Press** | 90 ms down / 120 ms release; translate at most 1 px, no bounce. | Proof submit, door selection, decoder Up/Down controls. | Border/color response only. |
| **Acquire** | One 320 ms sweep confined to the relevant status strip; subsequent wait uses text/static indicator. | Location request, Mission initial load. | Static icon and status. Never animate location acquisition as completion. |
| **Open** | 180 ms opacity + at most 8 px movement; `cubic-bezier(.2,.8,.2,1)`. | Reveal selected-door confirmation or open a decoder. | Immediate layout/content; optional opacity ≤100 ms. |
| **Seat** | 280 ms move/settle, no overshoot; one edge highlight ≤450 ms. | Reordered phrase moves one slot; server-confirmed Sigil/Founder Lock fills its actual slot. | Immediate placement with label/announcement. |
| **Reveal** | 450–700 ms total decorative build; persistent result is available immediately, Continue never waits for decoration. | Saved path ceremony, final Sigil, Master Cipher completion. | Static completed composition and all the same content/controls. |
| **Return** | 140 ms fade, no reverse tunnel/zoom. | Close transmission or result and restore the previous instrument/focus. | Immediate return. |

Routine route navigation does not need a cinematic overlay. Preserve scroll/focus meaning: tab navigation reaches its task region; opening a dialog moves focus into it; closing returns to its opener or the next meaningful action. Avoid typewriter delays on instructions, number rolling before verified totals, perpetual pulses, full-screen flashes, parallax while walking, and animation under the software keyboard.

Existing anchors: `ThreePathSelector` scroll/focus behavior; `PathLockEffect` staged transition; `GameMomentOverlay`; `HudReticle`; `HudParticlesCanvas`; `app/globals.css`. Retain necessary existing effects during incremental adoption, but do not add a particle library or new animation framework. Favor CSS/SVG/native APIs. Boardroom's approximate 50 KB gzip cosmetic-JS ceiling is a ceiling to verify, not an allowance to consume.

### 4.5 Sound restraint

Reuse `lib/audio/cq-sound-map.ts`, `cq-sound-manager.ts`, `lib/game-audio.ts`, and `SoundToggleControl`. Referenced CQ sound files exist in `public/audio/cq`; their loudness, length, and subjective quality were not auditioned here.

- **Touch:** `ui_click` or `ui_back`, optional and quiet. No sound on hover, scroll, polling, or background refresh.
- **Acknowledgment:** `ui_confirm` / `quest_complete` for the corresponding verified result; at most one foreground cue per receipt. A pending upload does not play completion.
- **Acquisition:** `scan` only during a deliberate relevant interaction. `lock_on` must not suggest server verification merely because coordinates arrived.
- **Recovery:** reuse `secret_reveal`, `chain_unlock`, or the appropriate existing reward mapping for a genuine unlock. Do not stack a separate XP, entry, badge, lock, and rank cue for one response.
- **Transmission:** brief existing channel cue, then voice owns the audio. Suppress cosmetic effects during speech/video. Preserve native media controls and handle browser autoplay refusal with an explicit Play affordance.
- **Culmination:** one existing appropriate cue after real completion. `finale_qualified` is not automatic evidence that Master Cipher was solved.

Preserve saved sound preferences and the legacy preference migration. Browser gesture unlock enables playback technically; it is not a design justification to make every subsequent action noisy. Expose sound control consistently and ensure the entire experience works muted. This proposal adds no ambient loop and no new audio asset. Audit procedural-plus-asset playback in `playCityScan` and `playPathLock` for duplicate emphasis before tuning volumes. Do not change the global first-use preference default as an unreviewed side effect.

### 4.6 Color, typography, geometry, and artwork

Use the existing CSS variables as the initial source of truth, with semantic aliases rather than parallel hardcoded palettes:

| Role | Existing value / proposed discipline |
|---|---|
| Device background / panel | `--bg-obsidian` `#0b0f17`; `--bg-card` `#161e2e`. Opaque task surfaces support outdoor reading; texture stays behind content. |
| Primary action / attention | `--accent-amber` `#f59e0b`. Amber indicates actionable emphasis or waiting, differentiated by text/icon and placement. |
| Information / channel / instrument | `--accent-cyan` `#06b6d4`. Use for tool framing and information, not every border. |
| Confirmed result | `--accent-emerald` `#10b981`, paired with a check and explicit state. |
| Error / safety | `--accent-rose` `#f43f5e`, paired with warning/error text. Never repurpose Challenge red alone as failure. |
| Path identity | Reuse `PATH_TONES`: Family `#f59e0b`, Challenge `#ef4444`, Secret `#a855f7`. Identity strip/badge only; status colors retain the same meaning on all paths. |
| Text | `--text-primary` `#f9fafb`; secondary `#9ca3af`. Muted `#6b7280` is not approved for critical small instructions without contrast verification. |

Outfit (`--font-display`) for short titles and moments; Inter (`--font-body`) for instructions, forms, errors, and prose; JetBrains Mono (`--font-mono`) for short statuses, counts, codes, and time. Rajdhani already exists; preserve artwork-specific uses, but do not add it as another default interface role. No new font dependency. Reserve uppercase/tracking for short labels, not paragraphs. Proposed minimums: 16 px body and form input, 14 px meaningful status/control text, 12 px optional metadata. Never put essential instructions solely in 10 px mono labels.

Use a small consistent corner radius (8 px task controls/panels), restrained 1 px borders, and one accent rail/reticle motif per instrument. Preserve larger-radius existing artwork frames where changing them would damage the supplied composition. Avoid making every panel glow, pulse, or carry a fake serial number. Glyphs must have text labels when they convey state.

Keep canonical logo, cards, doors, Commander media, and city imagery. Never regenerate, rename, squeeze, or infer missing artwork. Use `PlayerAvatar`, existing image resolvers and canonical registries. Required touch targets: at least 48 × 48 CSS px for primary and field controls, including icon buttons and tile movement. Contrast targets: 4.5:1 normal text, 3:1 large text and meaningful controls; these are acceptance targets, not current PASS claims.

### 4.7 Shared presentation ownership

Extend the existing system; no second event bus, sound singleton, reward engine, or blanket route-transition framework.

1. **Route owns the task and request.** Existing submit/entry/decode/finale callbacks keep authority and error handling. A local animation does not update grants or eligibility.
2. **Shared Field Protocol styles own visual states.** Adopt actual states at each caller; do not force unrelated server types into one large replacement enum.
3. **`gameMomentManager` owns foreground ceremony sequencing.** `GameEffectsProvider`/`GameMomentOverlay` remain the delivery surface. Existing contextual-transmission and viewed-state helpers retain dedupe responsibilities; server archive authorization remains separate.
4. **Persistent instrument owns the result.** Closing/skipping a moment must not lose the receipt, sentence, ownership, or solved reveal. Client Field Log supports replay but is not the authority for earned progress.

Presentation order for one confirmed result: update persistent UI → one combined factual receipt → optional highest-value story beat → return to the next objective. Preserve all actual rewards even when coalescing their visual presentation. Avoid independent legacy modal and shared overlay competing for focus. Do not retrigger a ceremony on refresh, tab switch, component remount, or `already_completed` response.

One foreground dialog at a time. Later work must supply accessible name, focus containment, inert background, visible close, Escape, scroll containment, and focus restoration consistently; existing `role="dialog"` alone is insufficient proof. Keep the current no-accidental-backdrop behavior for video/long transmissions. Reading time is independent of reduced-motion settings. Maintain deliberate Continue/Close for narrative text; never auto-close it merely because motion was shortened.

## 5. Phase 2 implementation handoff — core system

These are bounded follow-up work packages, not edits authorized by this document. Execute in dependency order; preserve the existing public interfaces unless a separately approved change requires otherwise.

| Task | Concrete scope / reuse | Done when |
|---|---|---|
| **P2-1: Field styles and vocabulary** | `app/globals.css`; shared button/status surfaces in `Header`, `CinematicNav`, hub, proof and decoder. Introduce only required CQ classes/semantic aliases from §4. | All three path tones use the same state grammar; errors remain unmistakable; mobile text/controls meet the specified sizes. No new Tailwind usage, assets, or font dependency. |
| **P2-2: Moment shell and receipts** | `lib/game-effects.ts`, `GameMomentOverlay`, existing reward renderers; inventory `GameFeedbackModal` callers before moving them. Implement motion, focus, sound ownership, and sequencing from §4. | One server result yields one factual receipt plus at most one major beat; every grant remains visible; Skip/Close returns focus; replay/remount does not invent awards. Video and text reading controls remain usable. |
| **P2-3: Mission continuity** | `FounderCipherShell`, hub tab handling, scoped redirects, `Header`, `CinematicNav`, `MobileStartBar`. | First-time overview remains available; returning Board/Map links reach their instrument; event context survives leaderboard/watch redirects; one mobile primary action is reachable without overlapping content. |
| **P2-4: Honest asynchronous states** | Registration resolution, hub loader, proof/GPS, transmission archive/player, district decode, finale and drawing loaders. | Network error differs from locked/empty/upcoming; local selection differs from save; pending review differs from verified; retry retains relevant task context and input. No pretend progress/success. |
| **P2-5: Labels and path consistency** | Existing `lib/path-tone.ts`, Founder message resolver/catalog, profile/rules/shell copy and drawing statistic labels. | Family/Challenge/Secret change style only; public copy agrees with current behavior; XP, drawing entries, Sigils, locks and Master Cipher status have distinct names. No development jargon in player flow. |

P2-1 and the state contract must be stable before flagship visual work. P2-2 must be stable before adding another full-screen moment. Functional deficiencies uncovered here—such as real media attachment support—need their own scoped task; cosmetic work must not imply they were implemented.

## 6. Phase 3 implementation handoff — flagship moments

Each flagship uses the same **Acquire → Seat → Reveal → Return** vocabulary, scaled to the event. “Reveal” is decorative timing; content and control availability must not wait for it.

| Moment | Trigger and sequence | Reuse / completion conditions |
|---|---|---|
| **F1: Identity issued through the doors** | Local door press highlights Selected and opens confirmation. Successful registration/path save seats the chosen identity, shows “Path saved,” then continues to the existing destination. Confirmation-required response stays on the email task. | `ThreePathSelector`, `FastPlayerOnboardForm`, `PathLockEffect`, entry callback, `PlayerCard`. Exactly one save ceremony; no reward/identity certainty from a click; no duplicate path lock after auth return. |
| **F2: First contact with the Commander** | Real authenticated participation → existing Cold Open → concise canonical `MISSION_BRIEFING` → next objective. Other path/achievement triggers use the same queue and must be reconciled against the first-entry sequence. | Current entry effects, registry, viewed-state helpers and `CommanderTextTransmission`. Keep videos 2/5 as manual briefing controls; do not add them to an automatic welcome chain. Slow video, mute, Skip, Close and replay all lead back to a usable task. |
| **F3: First verified field action** | Evidence submission stays on the instrument while verifying. On actual success, seat the verified mark, show exact XP/entry/collectible changes, then one highest-value Commander/unlock beat if appropriate. Next quest is immediately identifiable. | Quest submit/poll paths, `triggerQuestRewardSequence`, existing reward components. Partial step, pending media, duplicate completion and zero-entry results never play a false complete/token ceremony. |
| **F4: District Sigil decoded** | Recovered tiles are readable objects. Up/Down moves one tile with Seat. Verify holds the arrangement; incorrect response stays inline. Success displays the actual decoded sentence and fills that district's Sigil slot; Continue returns to its updated record. | `CipherFragmentsPanel` and existing decode result. Same feedback from hub and finale call sites. No drag-only interaction; no sentence auto-dismiss; every district order remains valid. |
| **F5: Founder Lock secured** | Real lock award seats THE MARK/THE CODE/THE WORD into its labeled slot and shows actual ownership count. Third lock creates a brief complete-set reveal, then checks the existing finale status for the next action. | `ThreeLocksFragmentEffect`, `threeLocksFragmentAwarded`, `threeLocksOwned`, contextual Founder messages. No inferred lock ownership from animations, quest titles, or client counters. Third lock is not automatically “Master Cipher ready.” |
| **F6: Master Cipher convergence and resolution** | Locked screen explains real missing requirements. Ready screen presents actual clue pieces and accessible solution input. Incorrect response is inline. Configured false finale reveals only its partial outcome. Server `completed` seats the final state, delivers the two canonical completion messages, and returns to durable solved record/reveal. | Finale route, `MasterCipherStatusCard`, `lib/finale.ts`, current message IDs. Configuration absent/closed/Watcher-required branches stay honest. `already_completed` shows the record without new ceremony. Do not mandate travel to West Lawn: the source explicitly leaves physical verification and destination role unresolved. |
| **F7: Earned closing record** | Event ended or published drawing outcome opens a clear record of that Mission, earned results, and available archive. Use existing data; optional prestige cue only for an actual new award. | Drawing, ended shell, scoped standings/archive and Player File. Narrative solve, prize selection, winner publication and global XP remain distinct; unpublished winners are never teased as facts. |

F1–F3 establish the pattern. F4–F6 are the flagship mystery progression. F7 provides closure without another promotional signup loop. No new lore, puzzle answer, media title, physical location, or reward rule is needed to implement this language.

## 7. Validation and handoff checks

**Phase 1 verification — PASS for artifact and scope:** individual-file Git status reported only `?? boardroom/recon/astra-experiential-audit.md`; the read-only index query returned no staged paths. A document check confirmed required journey/language coverage, 12 specific findings, core source/test references, and no trailing whitespace. `git diff --check` also passed for tracked changes. No application code changed, so lint/typecheck/unit suites were not run for this document. **PARTIAL for live experience:** authenticated browser and physical field validation remain unperformed as disclosed in §1. Boardroom retains its own checkpoint validation responsibility; no staging or commit was attempted.

**For subsequent code tasks:** run repository-required lint, typecheck, and unit suites, then meaningful rendered-flow checks. Existing relevant tests include `cinematic-game-effects`, `commander-transmission-and-reward-moments`, `transmission-return-nav-and-cold-open`, `transmission-archive-reveal`, `contextual-transmission-engine`, `universal-player-path`, `onboarding-bug-fixes`, `core-quest-rewards-backbone`, `founders-cipher-district-system`, `founders-cipher-finale`, and `founders-cipher-finale-flow`. Test names are discoverability anchors, not evidence they currently pass.

Required field-flow verification matrix:

- Anonymous registration, existing login, email confirmation and password recovery; preserve event/quest/QR `next` targets. Failed save never produces a saved-state ceremony.
- First entry versus return visit; each path plus no path; upcoming/active/ended; Fair must remain free of Cipher-specific content.
- Quest text/code, GPS denied/outside-radius, media pending review, multi-step partial acceptance, correct completion, duplicate completion, and delayed approval. Verify exact server rewards and one receipt sequence.
- Districts decoded in different orders; wrong sequence; network loss; successful sentence readable; Founder Locks separate from Sigils; no raw unrevealed answers in UI payloads.
- Finale not configured, missing locks, insufficient Sigils, optional Watcher, not yet open/closed, wrong solution, configured false finale, completion and revisit. Confirm real configuration in an authorized environment before claiming production readiness.
- Video slow/buffered/blocked, text replay, no-signal versus transport failure, safe return navigation, muted play and saved sound preference. No lost persistent result after Skip All.
- 360 px and 390 px phone widths, short viewport with keyboard, desktop, 200% zoom, keyboard-only and screen reader, reduced motion, bright outdoor reading. Measure contrast, touch targets, focus and layout; do not infer PASS from class names.
- Cellular latency/disconnect and background/resume; no cosmetic polling or particle work while hidden. Measure bundle delta and rendering cost against Boardroom's performance ceiling. No repeated approvals or grants caused by replay/refresh.

Report source confidence, test results, browser results, production configuration and field validation separately. A successful HTTP response or local unit test is not a full journey verification.

## 8. Known checkpoint blockers and exact write boundary

The supplied blocker reports two forms of the same suspicious path mismatch: a directory `boardroom/recon/` being treated as an out-of-scope change, and an exact staged-set comparison expecting that directory while seeing `boardroom/recon/astra-experiential-audit.md`. These messages alone do not prove an agent modified production files.

Current source evidence: `lib/boardroom/supervisor.ts` → `statusShort` already calls `git status --short --untracked-files=all` and documents the exact directory-collapse failure. `lib/boardroom/commitGate.ts` → `pathInScope` accepts matching files under a directory prefix. `tests/boardroom-hardening-extra.test.ts` is identified by the supervisor comment as regression coverage. This audit does not change or execute the supervisor, and does not claim the next Boardroom staging run has passed.

Checkpoint contract for this task:

- Authorized write prefix: `boardroom/recon/`.
- Exact expected changed file: `boardroom/recon/astra-experiential-audit.md`.
- No placeholder, `.gitkeep`, duplicate document, production code edit, or `DECISIONS.md` edit is needed. The proposed language awaits Boardroom review, so it is not recorded as an accepted architecture decision elsewhere.
- Agent verification uses individual-file enumeration (`git status --short --untracked-files=all`) and a read-only index check (`git diff --cached --name-only`). Plain short status may still display the directory; that is a representation, not a second deliverable.
- Boardroom must compare normalized actual file paths to its approved set when it performs its own stage/commit. If the older mismatch recurs, inspect the running supervisor version/path enumeration under a separate authorized task. Do not “fix” it by staging here or editing outside this scope.

This document supplies the common vocabulary, real integration points, trigger boundaries, visual/motion/sound defaults, and verification criteria for Phase 2 and Phase 3. Implementation and production proof remain subsequent work.
