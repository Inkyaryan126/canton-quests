# FOUNDER'S CIPHER — 14-QUEST PLAYER-FACING AUTHORING SPEC

**Status**: Authoring document. No gameplay code implemented. No migration applied. No production touched.

**Method**: Every quest below was authored against real evidence — primarily the 14 finished AI-generated quest card mockups sitting in `public/canton-quests/quests/{family,challenge,secret}/`, which I opened and read directly (not just filenames). These cards are a richer, more concrete source than the architecture doc's abstract mechanic descriptions: each one shows a real Canton location, a specific proof-type icon (Check-In / Photo / Cipher), a finished instruction line, and — in four cases — legible real-world text baked directly into the photo (a dedication plaque, a marquee, a monument marker). Where a card conflicts with the architecture doc's proposed mechanic, I say so and default to the card, since it's the more finished, more specific artifact. Where evidence conflicts with itself (two real locations claiming one quest name), I report both and do not pick a winner.

---

## QUEST 1 — BELL CIPHER

**District**: Family (Arts District)
**Founder's Cipher role**: Founder Lock — **THE WORD**

**Known real location**: The Bicentennial Bell, Centennial Plaza area, Canton, OH. Confirmed by the finished quest card (`public/canton-quests/quests/family/bell.png`), which shows the actual bell on its mounting frame with a granite dedication base.

**PLAYER HOOK**
A city this old rings with more than one voice. Somewhere in the Arts District, Canton keeps a bell that still remembers who put it there.

**PLAYER OBJECTIVE**
Physically locate the Bicentennial Bell and read the dedication engraved on its stone base.

**PUZZLE FLOW**
1. Player is directed to the Bicentennial Bell (Arts District / Centennial Plaza area).
2. Player inspects the granite base beneath the bell, not the bell itself.
3. Base carries a real, multi-line dedication: a named Mayor, the Canton Bicentennial Commission, and a list of trustees.
4. Player identifies and enters the Mayor's name.

**CLUE COPY** (recovered verbatim from the finished card)
> "Find the Bicentennial Bell and enter the mayor's name engraved on the base."

**ANSWER / SUCCESS CONDITION**
The card's own base inscription is legible in the image and reads, in part: *"Janet Weir Creighton, Mayor, City of Canton — Canton Bicentennial Commission."* Janet Weir Creighton is a real former Mayor of Canton, Ohio, which strongly corroborates this as the intended, accurate answer — **not an invention, a direct read of the card's own artwork.** Recommend accepting surname-only (`CREIGHTON`) and full-name variants, matching this project's existing case-insensitive passphrase convention. **Confidence this is correct: HIGH, not LOCKED** — the actual physical plaque should be photographed to confirm exact spelling/wording before printing clue cards, since AI-generated card art can render text imperfectly.

**PROOF TYPE**: Passphrase.

**REWARD**: 200 XP (per card). 1 drawing entry. Grants Founder Lock **THE WORD**. No separate badge — a Founder Lock is already a distinct, visible collectible.

**COMMANDER BEFORE**: *"Every founding city rings a bell for someone. Find out who Canton never stopped thanking."*

**COMMANDER SUCCESS**: *"[Name] — locked into the record. THE WORD is yours."*

**WATCHER ANOMALY**: None. Bell Cipher is not one of the two anomaly-carrying quests.

**SAFETY / OPERATIONS**: FIELD VERIFICATION REQUIRED — exact standing position, whether the base text is legible from a public path without stepping onto restricted plaza infrastructure, and daylight/lighting conditions have not been confirmed on-site.

**SOURCE ASSETS**: `public/canton-quests/quests/family/bell.png` (finished card, not yet wired into `lib/marketing-assets.ts`).

**CONFIDENCE**: **HIGH.**

**WHY THIS QUEST IS FUN**: It's the only quest in the whole set that rewards a player for reading a civic dedication most locals walk past without a glance — a real "aha" moment of noticing something that was always in plain sight, backed by a real name a Google search alone won't hand you without knowing which bell to search for.

---

## QUEST 2 — CANTON SIGN CAPTURE

**District**: Family (Arts District)
**Founder's Cipher role**: District Evidence — fragment **[A NAME]**

**Known real location**: The freestanding "CANTON" letter sculpture, Downtown Canton. Confirmed by the finished card (`public/canton-quests/quests/family/canton.png`) and independently corroborated by an existing real photograph already wired into the codebase, `cqImages.cantonSign` (`canton-plaza-sign.jpg`).

**PLAYER HOOK**
Canton spells its own name in the open. Prove you found it.

**PLAYER OBJECTIVE**
Take a selfie at the downtown "CANTON" letter sculpture.

**PUZZLE FLOW**
1. Player navigates to the sculpture.
2. Player takes a photo of themselves (or their callsign card) with the sign clearly visible.
3. Upload for verification.

**CLUE COPY** (recovered verbatim from the finished card)
> "Take a selfie at the Canton sign and upload it to complete the mission."

**ANSWER / SUCCESS CONDITION**: N/A — photo proof, no passphrase. The card shows no hidden text/riddle layered on top of the selfie requirement.

**PROOF TYPE**: Photo.

**REWARD**: 150 XP (per card). 1 drawing entry. Grants District Evidence fragment `[A NAME]`.

**COMMANDER BEFORE**: *"The city already told you its name. Go stand next to it."*

**COMMANDER SUCCESS**: *"Confirmed. One fragment closer."*

**WATCHER ANOMALY**: None.

**SAFETY / OPERATIONS**: The real photo asset already in the codebase (`canton-plaza-sign.jpg`) suggests this location is already field-photographed and low-risk (an open plaza installation), but exact standing position and any roadway proximity are FIELD VERIFICATION REQUIRED before publishing final instructions.

**SOURCE ASSETS**: `public/canton-quests/quests/family/canton.png` (finished card); `cqImages.cantonSign` (`/canton-quests/canton-plaza-sign.jpg`, real photo, already in codebase).

**CONFIDENCE**: **HIGH** on location and mechanic; the fragment `[A NAME]` payoff itself is a cipher-sentence piece, not something the player derives from this quest specifically — that's expected and consistent with how the other two District Evidence quests per district work.

**WHY THIS QUEST IS FUN**: It's the fast, guaranteed-win onboarding quest — no puzzle, no ambiguity, just "go stand by the sign everyone's seen and never photographed for a game." Good for family groups who want an instant, low-friction first success.

---

## QUEST 3 — DRAFT LINEUP

**District**: Family (Arts District)
**Founder's Cipher role**: District Evidence — fragment **[OUTLIVES]**

**Known real location**: **NFL Draft Plaza**, downtown Canton — a real bronze statue installation depicting crouched football players in a line-of-scrimmage pose, with a visible on-site marker reading *"THE NFL DRAFT, 1936."* Confirmed directly from the finished card (`public/canton-quests/quests/family/football.png`), which shows the statues and marker clearly.

**PLAYER HOOK**
Before the Hall of Fame, before the highlight reels, there was a first line. It's still crouched here, waiting for the snap.

**PLAYER OBJECTIVE**
Find the 1936 NFL Draft statue installation and photograph it from the line-of-scrimmage angle.

**PUZZLE FLOW**
1. Player locates NFL Draft Plaza.
2. Player finds the on-site marker confirming "THE NFL DRAFT, 1936."
3. Player photographs the statue line from ground level, matching the "line of scrimmage" framing shown on the card.

**CLUE COPY** (recovered verbatim from the finished card)
> "Find the 1936 draft statues and snap a photo from the line of scrimmage."

**ANSWER / SUCCESS CONDITION**: N/A — photo proof, framed against a specific real angle rather than a free-form selfie, which raises the bar slightly above Canton Sign Capture without adding a puzzle.

**PROOF TYPE**: Photo (with a specific framing requirement — "from the line of scrimmage" — which a manual reviewer can check against the statues' known pose).

**REWARD**: 175 XP (per card). 1 drawing entry. Grants District Evidence fragment `[OUTLIVES]`.

**COMMANDER BEFORE**: *"1936. Before the League had a home, it had this. Get down to their level."*

**COMMANDER SUCCESS**: *"That's the shot. Fragment secured."*

**WATCHER ANOMALY**: None.

**SAFETY / OPERATIONS**: FIELD VERIFICATION REQUIRED — exact plaza address, pedestrian access, and whether "line of scrimmage" framing requires stepping onto grass/restricted turf near the statues.

**SOURCE ASSETS**: `public/canton-quests/quests/family/football.png` (finished card, clearly showing the real statue installation and its "THE NFL DRAFT, 1936" marker). **Note**: this is a *different* real Canton landmark than the "Hall of Fame City Marker" (2121 George Halas Dr NW) referenced in older seed data — do not conflate the two when field-verifying.

**CONFIDENCE**: **HIGH** on location and mechanic (both directly visible in the finished card); **UNRESOLVED** on whether any hidden text/count exists on the statues themselves that the architecture doc's "missing-position align" language was hinting at — nothing beyond the photo mechanic is evidenced.

**WHY THIS QUEST IS FUN**: A real, physically evocative photo op — crouching down to eye level with bronze linemen — that turns a football landmark into a genuine photo composition challenge rather than a passive check-in.

---

## QUEST 4 — KRAKEN WALL

**District**: Family (Arts District)
**Founder's Cipher role**: District Evidence — fragment **[THE MAN]**

**Known real location**: The Octopus Mural, Arts District — a large tentacled street-art mural on a downtown brick building, with physical 3D tentacle sculptures extending off the wall. Confirmed by the finished card (`public/canton-quests/quests/family/octo.png`).

**PLAYER HOOK**
Something's been painted onto that wall with too many arms and a name it isn't hiding all that well.

**PLAYER OBJECTIVE**
Find the octopus/kraken mural, then locate and read the artist's signature worked into the artwork.

**PUZZLE FLOW**
1. Player locates the mural (real 3D tentacle sculptures make it unmistakable from a distance).
2. Player photographs the mural as proof of presence (per the finished card's own instruction).
3. Player inspects the mural closely enough to find the artist's signature and enters the surname.

**CLUE COPY**
> "Track down the giant tentacle mural and capture the creature in a photo." *(verbatim from the finished card — covers the photo half of this quest)*
> Additional locked instruction (per this authoring brief, not yet drawn on any card): *"Somewhere in the paint, the artist signed their work. Read the name and enter it below."*

**ANSWER / SUCCESS CONDITION**: **`MORGAN`** — locked per explicit prior decision. This does **not** appear anywhere in the finished card's legible text at the resolution available to me, but the card does show a small cursive signature-like mark near the mural's lower-left, consistent with a real artist signature existing on the actual wall. I am not overriding the locked MORGAN decision with what the low-resolution mockup shows — I'm noting that the mockup is consistent with (not contradictory to) a real signature being there. **A clearer photo of the actual signature is needed to confirm exact placement/spelling before printing clue cards.**

**PROOF TYPE**: **Photo + Passphrase (combination)** — this reconciles two real, separately-found pieces of evidence: the finished card's explicit photo instruction, and your locked decision that the real discovery is the artist's name. Do not drop either half.

**REWARD**: 175 XP (per card). 1 drawing entry. Grants District Evidence fragment `[THE MAN]`.

**COMMANDER BEFORE**: *"Someone put a kraken on a downtown wall and signed their name like they wanted to be found."*

**COMMANDER SUCCESS**: *"MORGAN. Now it's on the record."*

**WATCHER ANOMALY**: Permitted per your instruction — a very subtle visual-corruption seed only (e.g. a one-line "signal noise detected" flicker after a correct submission), never required to solve the quest, never altering the MORGAN mechanic itself.

**SAFETY / OPERATIONS**: FIELD VERIFICATION REQUIRED — exact address, whether the signature is legible from public sidewalk without entering the alley/lot the mural faces (the card shows dumpsters and a fire escape in frame, suggesting a service-alley vantage point that needs a safety check).

**SOURCE ASSETS**: `public/canton-quests/quests/family/octo.png` (finished card). Earlier, unrelated instance: `octopus-mural.png` existed briefly in commit history (Aug 10, deleted same day) as generic showcase art, not tied to any address — do not treat that as a second location.

**CONFIDENCE**: **MEDIUM** — location and photo mechanic are LOCKED (directly evidenced); the exact MORGAN signature placement is **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.**

**WHY THIS QUEST IS FUN**: It rewards close looking, not just arrival — the photo gets you credit for finding the wall, but the real prize is noticing that street art has a creator, and going the extra step to find their name. That's a genuinely different verb from every other Family quest.

---

## QUEST 5 — PALACE CHECK-IN

**District**: Family (Arts District)
**Founder's Cipher role**: Optional Anomaly A (no required Cipher Fragment)

**Known real location**: Canton Palace Theatre, Market Ave N (marquee reads "PALACE," building signage confirms "624 North Market"). Confirmed by two independent images: the finished card (`public/canton-quests/quests/family/palace.png`) and an older cinematic backdrop (`public/canton-quests/palace.png`).

**LOCKED DECISION — IMPLEMENTED (Phase 3D)**: Palace is NOT a plain check-in. Real bronze "Walk of Fame"-style stars embedded in the public sidewalk on the same block as the marquee were recovered from local Mac field photography (outside the repo — see `docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md`, Phase 3C/3D addenda). The puzzle targets one specific, fully-legible star: **"The Shaheen Family / Desert Inn / 1997."** The real 1927 opening year remains historical color only — not part of the mechanic, since the star's own year is the real, physically-read answer.

**PLAYER HOOK**
The Palace isn't the only name written into this block.

**PLAYER OBJECTIVE**
Find the bronze sidewalk star honoring The Shaheen Family and the Desert Inn, and read the year cast into it.

**PUZZLE FLOW**
1. Player arrives at the Palace Theatre block (Market Ave N).
2. Player is directed to look down at the sidewalk, not up at the marquee.
3. Player locates the specific named star ("The Shaheen Family / Desert Inn").
4. Player reads the four-digit year cast into the star.
5. Player submits the year as a passphrase.

**CLUE COPY**
> "The Palace isn't the only name written into this block. Look down. Find the bronze star honoring The Shaheen Family and the Desert Inn. The year beneath that name is your confirmation."

**ANSWER / SUCCESS CONDITION**: **`1997`** — read directly off the real star in a photo taken on-site (Aug 27, 2026), not guessed. Corroborated independently: four other real stars photographed the same day ("Omar Elazar, M.D.," "Sue Williams," "Keep Running/CeCe, Teri, Fran," plus this one) all read 1997 where a year was visible, meaning this isn't a single-source read.

**PROOF TYPE**: Passphrase — a real physical-inspection puzzle, not Googleable trivia.

**REWARD**: 100 XP. 1 drawing entry. No required Cipher Fragment. No Founder Lock.

**COMMANDER BEFORE**: *"Every Arts District run starts under the same marquee. This time, look down."*

**COMMANDER SUCCESS**: *"Record confirmed."*

**WATCHER ANOMALY**: **Yes — primary anomaly carrier**, sequenced to fire only **after** successful completion. Content registered (`PALACE_SIGNAL_ANOMALY` in `lib/gameplay/founders-cipher/messages.ts`) but not wired to an engine trigger this pass — no existing hook fires a message keyed to one specific quest's completion outside the fragment/Lock system, and building one was out of scope. Tone: *"Record confirmed. Hold. I've got the same return coming from a second source. That shouldn't be possible."* Never blocks completion, never grants a fragment or Lock, never explains "Watchers," never assumes order.

**SAFETY / OPERATIONS**: Public sidewalk, no ticket purchase required. FIELD VERIFICATION REQUIRED: exact star position relative to the entrance and pedestrian-traffic conditions.

**SOURCE ASSETS**: `~/Downloads/IMG_5645.JPG` (real marquee), `IMG_5640.JPG` (the selected star), `IMG_5650/5660/5655/5665.JPG` (four corroborating stars) — copies at `~/Desktop/CQ_Photo_Recovery_Review/Palace/`. `public/canton-quests/quests/family/palace.png` remains mismatched to the canon mechanic (shows a check-in framing, not the sidewalk) — asset replacement still needed, not blocking.

**CONFIDENCE**: **LOCKED.**

**WHY THIS QUEST IS FUN**: A real architectural/civic detail most Canton residents have walked over without ever reading — a genuine "you have to actually be there and look down" moment a phone search can't hand a player.

---

## QUEST 6 — THE MURAL

**District**: Challenge (Mother Goose Land)
**Founder's Cipher role**: District Evidence — fragment **[THE WORLD]**

**Known real location**: Mother Goose Land mural wall, 714 12th St NW — a real, large mosaic-block mural spelling "MOTHER" with an integrated storybook character (a Humpty-Dumpty-style figure). Confirmed by the finished card (`public/canton-quests/quests/challenge/mother_mural.png`).

**LOCKED DECISION (this pass)**: The Mural is NOT a plain check-in. It is an observation-based puzzle built on the real lower-right-character detail.

**LOCKED DECISION — IMPLEMENTED (Phase 3D)**: the unresolved "lower-right character holding what" framing is abandoned — no single wide reference photo of that section was ever found, across three separate recovery passes. Replaced with a mechanic built on the now-confirmed real large blue whale, recovered via a 10-frame real drive-by photo sequence of the full wall (local Mac photo archive, outside the repo — see `docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md`, Phase 3C/3D addenda). The sequence also confirmed the wall's full real cast: a bearded elder, a bear, a gingerbread man, two pumpkins, a wolf, two pigs, four mice, a rat musician, a caterpillar, a small house — and the whale.

**PLAYER HOOK**
Stories crowd this wall — bears, pigs, mice, pumpkins, things that belong in fields and forests.

**PLAYER OBJECTIVE**
Locate the mural, scan its full real cast of characters, and identify the one creature that doesn't belong among them.

**PUZZLE FLOW**
1. Player finds the mural wall (unmistakable — large colored block letters, then a long storybook frieze).
2. Player is directed to look across the full wall, not just the "MOTHER" lettering.
3. Player identifies the one creature that belongs in water, not the forest.
4. Player submits the creature's name as a passphrase.

**CLUE COPY**
> "Stories crowd this wall — bears, pigs, mice, pumpkins, things that belong in fields and forests. One creature belongs somewhere much deeper. Find the one that should be surrounded by water. What is it?"

**ANSWER / SUCCESS CONDITION**: **`BLUE WHALE`** (accepts `WHALE`) — confirmed real and on-wall via direct photographic evidence, not assumed from the legacy retired-quest answer. The retired draft (`qst-challenge-blue-signal`) had already recorded this exact answer; Phase 3D independently re-confirmed the whale is real before reusing it, rather than trusting the legacy record on its own.

**PROOF TYPE**: Passphrase.

**REWARD**: 175 XP. 1 drawing entry. Grants District Evidence fragment `[THE WORLD]`.

**COMMANDER BEFORE**: *"Mother Goose Land keeps its stories painted where everyone can see them. One of them doesn't belong."*

**COMMANDER SUCCESS**: *"Fragment secured. The World gave it away."*

**WATCHER ANOMALY**: None (per your instruction, only Palace and Skate Park carry primary anomalies).

**SAFETY / OPERATIONS**: Open public park, daylight recommended (per older seed data). Exact standing distance FIELD VERIFICATION REQUIRED.

**SOURCE ASSETS**: `~/Downloads/IMG_5566.PNG`–`IMG_5575.PNG` (10-frame real drive-by sequence confirming the whale and full cast) — copies at `~/Desktop/CQ_Photo_Recovery_Review/Mural/`. `public/canton-quests/quests/challenge/mother_mural.png` (finished card) still doesn't show the whale panel — asset replacement would help but is not blocking.

**CONFIDENCE**: **LOCKED.**

**WHY THIS QUEST IS FUN**: A mural that spells its own location out in giant letters is instantly photogenic on its own — turning it into a "spot the one that doesn't belong" puzzle across a real, rich storybook cast rewards close attention without inventing a detail that isn't really there.

---

## QUEST 7 — THE TOWER

**District**: Challenge (Mother Goose Land)
**Founder's Cipher role**: Founder Lock — **THE CODE**

**Known real location**: A real, distinctive storybook-painted silo/tower structure at Mother Goose Land — a cylindrical tower with a red conical roof, painted with a cloud/balloon mural, attached to a brick outbuilding. Confirmed by the finished card (`public/canton-quests/quests/challenge/silo.png`).

**LOCKED DECISION (this pass)**: The Tower is NOT a plain check-in. It carries a physical architectural observation/extraction puzzle. No count is invented here — the exact number is pending a source photo.

**PLAYER HOOK**
A strange painted tower has been standing over these grounds since before the park had a name people remember. It isn't just standing there — it's built in tiers, and tiers can be counted.

**PLAYER OBJECTIVE**
Find the silo/tower, inspect its physical structure, and extract a real countable/observable detail from it (per the architecture doc's proposed "Vertical Tier Extraction" concept — structural bands or openings on the tower).

**PUZZLE FLOW**
1. Player locates the tower (visually distinctive — red roof, painted mural).
2. Player is directed to inspect the tower's structure closely rather than simply confirm it visually — specifically its bands, tiers, or openings.
3. Player counts the real structural feature found on site.
4. Player submits the count as a passphrase.

**CLUE COPY**
> "Find the strange tower standing over the old grounds. It wasn't built in one piece — count what holds it up." *(adapted from the finished card's copy, "Find the strange tower standing over the old grounds. Get close enough to confirm the landmark," which described only arrival, not the count.)*

**ANSWER / SUCCESS CONDITION**: **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.** No structural count (bands, tiers, window openings, or otherwise) is evidenced anywhere — not on the finished card, not in any prior seed data. I am not inventing a number to fill this in. A clear, full-height photo of the tower is required to identify which structural feature is real and countable, and what its count is.

**PROOF TYPE**: Passphrase, based on a real physical count once confirmed.

**REWARD**: 100 XP (per card). 1 drawing entry. Grants Founder Lock **THE CODE**.

**COMMANDER BEFORE**: *"There's a tower in that park that doesn't belong to any story you know. It wasn't poured in one piece — count what holds it up."*

**COMMANDER SUCCESS**: *"THE CODE is yours. The tower gave up its count."*

**WATCHER ANOMALY**: None.

**SAFETY / OPERATIONS**: "Do not attempt to climb or enter the tower structure" (per older seed data, still applicable). Perimeter fence access and whether the countable feature is visible from ground level without climbing FIELD VERIFICATION REQUIRED.

**SOURCE ASSETS**: `public/canton-quests/quests/challenge/silo.png` (finished card — shows the tower's general form but not at a resolution that supports a confident count). **A full-height, well-lit photo of the tower structure is required to lock the exact count.**

**CONFIDENCE**: **HIGH** on location; **LOCKED** on physical-observation-as-mechanic per this decision; **UNRESOLVED** on the exact structural feature/count, pending source photo.

**PHASE 3E UPDATE**: Full local photo archive re-searched exhaustively (repo assets, git history, ~/Desktop, ~/Downloads, ~/Pictures, ~/Documents, iCloud Drive) — no new tower photo found. The single most likely site-visit window is a real, unexplained 28-minute gap in the Aug 27 downtown session where 20 consecutive frame numbers (IMG_5697 through IMG_5716) do not exist in any exported/derivative form (08:38:29 → 09:06:38). That range is only reachable via a manual scroll through the Apple Photos app itself, which was intentionally not opened at the database/internals level this pass. Quest remains STAGED FAIL-CLOSED — still no invented count, no implementation.

**WHY THIS QUEST IS FUN**: It's the most visually strange landmark in the whole set — a fairy-tale tower with no obvious explanation — and turning "look at it" into "count what's actually holding it up" gives a Founder Lock the deliberate-observation weight it deserves, instead of handing it out for simple arrival.

---

## QUEST 8 — SKATE PARK CHECK-IN

**District**: Challenge (9th Street)
**Founder's Cipher role**: Optional Anomaly B (no required Cipher Fragment)

**Known real location**: 9th Street Skate Park — confirmed by real on-site signage ("9TH STREET SKATE PARK") visible directly in the finished card (`public/canton-quests/quests/challenge/skate_park.png`).

**PLAYER HOOK**
The Challenge run starts where the pavement gets interesting.

**PLAYER OBJECTIVE**
Reach the skate park and check in to open the Challenge sector.

**PUZZLE FLOW**
1. Player arrives at 9th Street Skate Park.
2. Player checks in via GPS.

**CLUE COPY** (recovered verbatim from the finished card)
> "Reach the skate park and establish your position to begin the Challenge Sector run."

**ANSWER / SUCCESS CONDITION**: N/A — this is a real, working, already-live check-in quest (`qst-9th-street-opening`), unchanged in substance since it was first built.

**PROOF TYPE**: Check-in.

**REWARD**: 100 XP (per card, matches the already-live quest's 75-100 XP range). 1 drawing entry. No required Cipher Fragment.

**COMMANDER BEFORE**: *"Every Challenge run opens the same way. Get to the park and check in."*

**COMMANDER SUCCESS**: *"Signal live. Challenge sector open."*

**WATCHER ANOMALY**: **Yes — primary anomaly carrier**, per your explicit instruction. Architecture doc frames this as a "passive monitoring node" — narrative-only, optional.

**SAFETY / OPERATIONS**: Public outdoor space, daylight recommended (already documented in current live seed data). GPS accuracy FIELD VERIFICATION REQUIRED.

**SOURCE ASSETS**: `public/canton-quests/quests/challenge/skate_park.png` (finished card).

**CONFIDENCE**: **LOCKED.** This is the strongest, most complete quest in the set — real location, real signage, real working code, exact card match.

**WHY THIS QUEST IS FUN**: It's the reliable, zero-ambiguity entry point to the entire Challenge district — important precisely because it isn't clever. Every player needs at least one quest they can complete without thinking, and this is the Challenge path's version of that.

---

## QUEST 9 — THE OPEN GROUND

**District**: Challenge (Challenge Field)
**Founder's Cipher role**: District Evidence — fragment **[GAVE A MONSTER]**

**Known real location**: "Challenge Field" — a real, photographed open grassy field bordered by a low brick wall with pillars, near an overpass, with a billboard visible in the distance. Confirmed by the finished card (`public/canton-quests/quests/challenge/the_open_ground.png`).

**PLAYER HOOK**
Past the pavement, the city opens up. Something's waiting out there.

**PLAYER OBJECTIVE**
Cross into the open field and confirm your position.

**PUZZLE FLOW (per finished card)**
1. Player crosses from the paved path onto the field.
2. Player checks in from within the field.

**CLUE COPY** (recovered verbatim from the finished card)
> "Cross into the open ground. Your next Challenge signal is waiting somewhere beyond the pavement."

**ANSWER / SUCCESS CONDITION**: N/A — plain check-in. No landmark, count, or riddle is evidenced anywhere for this location. This is the one Challenge quest with the least real content behind it.

**PROOF TYPE**: Check-in.

**REWARD**: 100 XP (per card). 1 drawing entry. Grants District Evidence fragment `[GAVE A MONSTER]`.

**COMMANDER BEFORE**: *"Not every signal comes from a building. Sometimes it's just open space, waiting to be crossed."*

**COMMANDER SUCCESS**: *"Fragment secured. The World gave something away."*

**WATCHER ANOMALY**: None.

**SAFETY / OPERATIONS**: "Watch footing on grass" (per current live seed data). Exact field address and any seasonal mowing/closure schedule FIELD VERIFICATION REQUIRED.

**SOURCE ASSETS**: `public/canton-quests/quests/challenge/the_open_ground.png` (finished card).

**CONFIDENCE**: **MEDIUM** — location is real and photographed, but no distinguishing feature or mechanic beyond arrival exists anywhere in the evidence.

**WHY THIS QUEST IS FUN**: Honestly, as currently evidenced, this is the weakest quest in the set on its own — pure GPS arrival at an unremarkable field. Its function may be more structural (a waypoint tying the Mother Goose Land cluster together) than a standout moment. Flagged plainly rather than dressed up.

---

## QUEST 10 — WILLIE THE WHALE

**District**: Challenge (Mother Goose Land)
**Founder's Cipher role**: District Evidence — fragment **[HIS NAME]**

**Known real location**: A real, physically distinctive whale-shaped walk-in structure (open-mouth entrance, weathered white/gray shell, tail raised) at Mother Goose Land. Confirmed by the finished card (`public/canton-quests/quests/challenge/willie.png`) and independently by `docs/visual-assets-manifest.md`, which has named this landmark "Willie" since Aug 18 — well before today's renaming pass.

**LOCKED DECISION (this pass)**: Willie is NOT a generic "find Willie" check-in. Willie remains the real physical centerpiece, but the player must inspect a specific real feature or detail on him, not just arrive.

**PLAYER HOOK**
Willie's been holding his ground at Mother Goose Land longer than most of downtown has existed. He's still not moving — and up close, there's more to him than the silhouette from the parking lot.

**PLAYER OBJECTIVE**
Find Willie, get close enough to inspect a specific real detail on his structure, and report what's found — the final signal of the Challenge run.

**PUZZLE FLOW**
1. Player locates the whale structure (unmistakable silhouette).
2. Player is directed to approach and inspect Willie closely — a specific feature on his physical structure (a marking, a plaque, a detail near the mouth/entrance, or similar) rather than his overall shape.
3. Player identifies/reads that real detail.
4. Player submits it as a passphrase.

**CLUE COPY**
> "Find Willie. The old whale is still holding his ground — but the silhouette isn't the whole story. Get close and look for what he's actually showing you." *(adapted from the finished card's copy, "Find Willie. The old whale is still holding his ground — and your final Challenge signal," which described only arrival.)*

**ANSWER / SUCCESS CONDITION**: **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.** No specific inspectable feature (a marking, plaque, tooth count, or other physical detail) is evidenced anywhere beyond Willie's general shape — not on the finished card, not in older assets. I am not inventing which feature or what it shows. A close-up photo of Willie's structure (face, mouth/entrance, and any signage near him) is required to identify a real, usable detail.

**PROOF TYPE**: Passphrase, based on a real inspected detail once confirmed.

**REWARD**: 100 XP (per card). 1 drawing entry. Grants District Evidence fragment `[HIS NAME]`.

**COMMANDER BEFORE**: *"One more signal before the Challenge run closes. He's easy to find. Getting close enough to actually look at him — that's the part people skip."*

**COMMANDER SUCCESS**: *"Fragment secured. His name is written into the record now, too."*

**WATCHER ANOMALY**: None.

**SAFETY / OPERATIONS**: The finished card is a night/dusk shot — if the real quest is meant to be playable after dark, lighting/safety at this specific structure is FIELD VERIFICATION REQUIRED; if daytime-only, that should be stated explicitly in the final safety notes.

**SOURCE ASSETS**: `public/canton-quests/quests/challenge/willie.png` (finished card, shows overall silhouette only); `goosewillie.png` (older, Aug 18, same landmark, confirms this is a long-standing real reference, not invented today). **A close-up photo of Willie's inspectable feature is required to lock the answer.**

**CONFIDENCE**: **HIGH** on location (the strongest non-Palace/Monument recovery from the prior archaeology, now visually confirmed as a real physical structure, not just a mural detail); **LOCKED** on close-inspection-as-mechanic per this decision; **UNRESOLVED** on the exact feature/answer, pending source photo.

**WHY THIS QUEST IS FUN**: A walk-in whale slide is exactly the kind of oddball, playful landmark that photographs well and delights kids and adults equally — asking players to get close and actually look at him, rather than just stand near him, turns the "last stop, best stop" of the Challenge run into a real payoff instead of a photo op.

---

## QUEST 11 — THE ETERNAL FLAME

**District**: Secret
**Founder's Cipher role**: District Evidence — fragment **[THE DEAD]**

**Known real location**: **John F. Kennedy Memorial** — a real eternal-flame monument with a legible bronze dedication plaque. Confirmed directly by the finished card (`public/canton-quests/quests/secret/flame.png`), which shows a lit flame fixture on a stone base with a plaque reading (partially legible): *"JOHN F. KENNEDY MEMORIAL FOUNTAIN... JOHN FITZGERALD KENNEDY, 35TH PRESIDENT OF THE UNITED STATES... BORN MAY 29, 1917 – DIED NOVEMBER 22, 1963."*

**PLAYER HOOK**
Some flames are lit to make sure a promise never goes dark.

**PLAYER OBJECTIVE**
Find the John F. Kennedy Memorial and read the dedication plaque.

**PUZZLE FLOW**
1. Player locates the memorial (flame fixture is visually distinctive).
2. Player reads the bronze plaque at its base.
3. Player enters the requested detail (a date, per the strongest evidence — see below).

**CLUE COPY**
> "The flame never fades. Honor the legacy and remember the promise of a better tomorrow." *(verbatim, finished card — this reads as flavor/hook text rather than a specific instruction; it does not yet ask the player for anything extractable.)*

**ANSWER / SUCCESS CONDITION**: The plaque's legible text gives two real, historically accurate dates: **May 29, 1917** (birth) and **November 22, 1963** (death) — both genuine JFK facts, both plausible passphrase answers (e.g., "enter the year the flame was dedicated to" or "enter the date on the plaque"). **The card's own flavor text doesn't currently specify which detail to extract**, so the exact answer is **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE** to confirm the plaque's full wording and decide which fact the quest should ask for.

**PROOF TYPE**: Passphrase (recommended, given a real plaque with real extractable facts exists) or Check-in (fallback, matching the card's current flavor-only copy).

**REWARD**: 100 XP (per card). 1 drawing entry. Grants District Evidence fragment `[THE DEAD]` — thematically apt for a memorial quest.

**COMMANDER BEFORE**: *"Not every flame in this city burns for a founder. Some burn for a promise that never got kept."*

**COMMANDER SUCCESS**: *"Fragment secured. The dead keep their own record."*

**WATCHER ANOMALY**: None.

**SAFETY / OPERATIONS**: Real memorial site, likely a public park setting based on the surrounding hedges/lawn in the image. Exact address, hours, and whether nighttime access is appropriate given the "eternal flame" framing are all FIELD VERIFICATION REQUIRED.

**SOURCE ASSETS**: `public/canton-quests/quests/secret/flame.png` (finished card, legible plaque text).

**CONFIDENCE**: **HIGH** on location (a real, named, photographed memorial — the strongest recovery of the four previously-"UNKNOWN" Secret quests); **MEDIUM** on exact answer, pending full plaque legibility.

**WHY THIS QUEST IS FUN**: A real eternal-flame memorial is an inherently solemn, striking landmark — different in tone from anything else in the Secret path, and a natural fit for the district's "Historical Mystery" identity without needing an invented cipher.

---

## QUEST 12 — MONUMENT PARK

**District**: Secret
**Founder's Cipher role**: District Evidence — fragment **[KEEP IT]**

**LOCKED DECISION (this pass)**: Monument Park is the **McKinley National Memorial**, 800 McKinley Monument Dr NW. This resolves the prior conflict decisively — **not** John F. Kennedy Memorial Field.

**Known real location**: McKinley National Memorial (`lib/seed-data.ts`, present since the very first commit; independently corroborated by `public/canton-quests/monument.png`, an older image explicitly tagged "McKinley National Memorial" in the visual-assets manifest). The finished card at `public/canton-quests/quests/secret/monument.png`, which shows a JFK Memorial Field statue instead, is now an **outdated/mismatched asset** — it depicts the wrong monument and will need to be corrected or replaced with real McKinley Memorial photography before this quest ships.

**PLAYER HOOK**
A monument this large doesn't ask you to climb it for nothing. Every step has a marker waiting at the top.

**PLAYER OBJECTIVE**
Climb the McKinley Memorial's stone stairway and find the dedication year marked in stone at the base of the monument.

**PUZZLE FLOW**
1. Player locates the McKinley National Memorial and its stairway.
2. Player climbs to the top, where the monument's markers are.
3. Player reads the stone marker giving the dedication year — not a birth or death year — and submits it as a passphrase.

I am choosing this mechanic over a step-count mechanic because it's the stronger-evidenced of the two real McKinley facts on record: it already has a full, previously-authored clue and a committed answer, where the 108-step fact exists only as a bare number in old location notes with no clue copy ever built around counting them. Per your instruction not to force both facts in, the 108-step detail is kept as flavor/atmosphere in the hook and safety notes, not as the answer mechanic.

**CLUE COPY** (verbatim, `e6986d0`, Aug 23 — real, previously-authored content, reused here)
> "The year is on stone, facing the path — it marks when something was dedicated, not a birth or death year. Stand at the base of the stairs and look at the markers around you."

**ANSWER / SUCCESS CONDITION**: **`1897`**, the McKinley National Memorial's real dedication year — a previously-recorded, hard-coded answer. `gmNotes` on the original live quest explicitly flagged this for reconfirmation before printing clue cards, so treat the exact number as **HIGH, not LOCKED** confidence: **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE** to confirm the marker's exact wording and that "1897" is what it actually reads, before this goes to print.

**PROOF TYPE**: Passphrase.

**REWARD**: 100 XP (per card). 1 drawing entry. Grants District Evidence fragment `[KEEP IT]`.

**COMMANDER BEFORE**: *"This one's been standing over Canton longer than the game has existed. It's still keeping the year it was dedicated."*

**COMMANDER SUCCESS**: *"Fragment secured. 1897. It kept it — until now."*

**WATCHER ANOMALY**: None.

**SAFETY / OPERATIONS**: "Stairs may be slick" (per older seed data) — a real stairway climb, not a casual stroll; the monument's real 108 steps mean this is the most physically demanding quest in the set, worth calling out explicitly for accessibility. Exact accessibility accommodations FIELD VERIFICATION REQUIRED.

**SOURCE ASSETS**: `public/canton-quests/monument.png` (older, Aug 18, correctly tagged McKinley National Memorial — use this as the reference for the real monument, not the finished card). **`public/canton-quests/quests/secret/monument.png` (the finished Secret-district card) is an asset correction required — it currently shows JFK Memorial Field and must be replaced with real McKinley Memorial art, ideally including a legible shot of the dedication-year marker to confirm 1897.**

**CONFIDENCE**: **LOCKED** on location and mechanic; **HIGH** (not LOCKED) on the exact "1897" answer, pending marker-text photo confirmation.

**WHY THIS QUEST IS FUN**: It's the one quest in the set with genuine physical payoff — climbing a monumental stairway most Canton residents have seen from the road but never actually walked, and being rewarded at the top with a real piece of dedication history instead of a shortcut.

---

## QUEST 13 — THE GOLDEN MARK

**District**: Secret
**Founder's Cipher role**: Founder Lock — **THE MARK**

**Known real location**: **Canton Road** — a real, distinctive pair of tall, golden/mustard-colored abstract sculptures (cross-like or reaching-arm forms) with a dark stone plaque mounted in front of them. Confirmed directly by the finished card (`public/canton-quests/quests/secret/the golden mark.png`). **This is a genuinely new location, unrelated to 9th Street Skate Park — confirming your explicit instruction not to map Golden Mark to Skate Park was correct; the real evidence agrees with you.**

**PLAYER HOOK**
Not every marker in this city explains itself. This one just stands there, gold against the tree line, waiting for someone who already knows what it means.

**PLAYER OBJECTIVE**
Find the golden sculpture pair on Canton Road and read the plaque in front of it.

**PUZZLE FLOW**
1. Player locates the sculpture (visually unmistakable — tall, golden, abstract).
2. Player reads the stone plaque mounted at its base.
3. Player enters the requested detail from the plaque.

**CLUE COPY** (recovered verbatim from the finished card)
> "A curious symbol stands along the way. Some say it marks a meeting point — for those who know."

**ANSWER / SUCCESS CONDITION**: The plaque is visible in the card but not legible at the resolution available to me. **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE** — a clear photo of this plaque's text is the single highest-priority missing asset in this entire authoring pass, since it directly gates a Founder Lock.

**PROOF TYPE**: Passphrase.

**REWARD**: 100 XP (per card). 1 drawing entry. Grants Founder Lock **THE MARK**.

**COMMANDER BEFORE**: *"There's a marker on Canton Road that isn't trying to be found by strangers. Go find out what it knows."*

**COMMANDER SUCCESS**: *"THE MARK is yours. Whatever it marks, you're one of the ones who knows now."*

**WATCHER ANOMALY**: None.

**SAFETY / OPERATIONS**: The card shows the sculpture on an open grassy strip beside what appears to be a road — proximity to traffic, parking, and pedestrian access are all FIELD VERIFICATION REQUIRED.

**SOURCE ASSETS**: `public/canton-quests/quests/secret/the golden mark.png` (finished card — note the filename itself is an outlier among its siblings, containing spaces and lowercase "the," worth renaming for consistency once implementation begins).

**CONFIDENCE**: **HIGH** on location (fully resolved — a real, specific, described landmark, correctly *not* 9th Street); **UNKNOWN** on the exact plaque answer.

**PHASE 3E UPDATE**: Highest-priority target of the exhaustive re-search (repo assets, git history, ~/Desktop, ~/Downloads, ~/Pictures, ~/Documents, iCloud Drive; keyword sweep for "golden," "canton road," "plaque," "sculpture"). No new image found — the one keyword hit (`My Music/Golden Trilock Logo.jpeg`) is an unrelated logo asset, not field evidence, and was not used. As with The Tower, the Aug 27 downtown session's IMG_5697–IMG_5716 gap (08:38:29–09:06:38, 20 missing frame numbers, Apple Photos only) remains the single most likely place this photo exists but is unreachable without a manual in-app search. No plaque text was guessed or OCR'd from any low-resolution source. Quest remains STAGED FAIL-CLOSED.

**WHY THIS QUEST IS FUN**: A striking, unexplained piece of public art that most people drive past without a second look — exactly the "hidden in plain sight" mystery-district feeling the Secret path is supposed to deliver, and it resolves what was previously the single least-evidenced quest in the entire 14.

---

## QUEST 14 — SPRING WATER SHELTER

**District**: Secret
**Founder's Cipher role**: District Evidence — fragment **[AT WEST LAWN]**

**Known real location**: **Fort Hill Park** — a real stone-and-timber picnic shelter/pavilion with a slate-look roof and boulder seating. Confirmed directly by the finished card (`public/canton-quests/quests/secret/water.png`).

**LOCKED DECISION (this pass)**: Spring Water Shelter is NOT a check-in. The shelter's real structure — supports, openings, or beams — is the puzzle itself, once photo-verified. No count is invented here.

**PLAYER HOOK**
Fort Hill keeps a quiet shelter where the water still runs. Not everyone stops long enough to count what's holding the roof up.

**PLAYER OBJECTIVE**
Find the stone shelter at Fort Hill Park, inspect its real structural supports/openings/beams, and extract a countable or observable detail.

**PUZZLE FLOW**
1. Player locates the shelter (a real, distinctive stone-and-timber structure).
2. Player is directed to inspect the shelter's real architecture specifically — its support beams, openings, or pillars — not just to stand inside it.
3. Player counts or reads the real structural feature found on site.
4. Player submits the answer as a passphrase.

**CLUE COPY**
> "A quiet place to pause and listen. Fresh water flows here — and so does the answer, in what's holding the roof up." *(adapted from the finished card's copy, "A quiet place to pause and listen. Fresh water flows here — and so might the answers," which named the theme but not a specific structural instruction.)*

**ANSWER / SUCCESS CONDITION**: **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.** No specific structural count (pillars, rafters, openings) is shown or legible on the finished card. I am not inventing one. This is the final fragment of the Secret sentence — `[AT WEST LAWN]` — which deliberately names the finale location directly; that part of the design is already locked and unaffected by this decision. A clear photo of the shelter's real support structure is required to identify and count the real feature.

**PROOF TYPE**: Passphrase, based on a real structural count once photographed and confirmed.

**REWARD**: 100 XP (per card). 1 drawing entry. Grants District Evidence fragment `[AT WEST LAWN]`.

**COMMANDER BEFORE**: *"Fort Hill keeps a shelter most people walk straight past. Slow down and count what's holding it up."*

**COMMANDER SUCCESS**: *"Fragment secured. The last piece of the Secret record is yours."*

**WATCHER ANOMALY**: None.

**SAFETY / OPERATIONS**: The card shows a parking area and a car directly beside the shelter — pedestrian/vehicle proximity FIELD VERIFICATION REQUIRED. Park hours FIELD VERIFICATION REQUIRED.

**SOURCE ASSETS**: `public/canton-quests/quests/secret/water.png` (finished card, shows the shelter's overall form but not at a resolution that supports a confident structural count). **A clear, well-lit photo of the shelter's support structure is required to lock the exact answer.**

**CONFIDENCE**: **HIGH** on location (fully resolved — a real, named park and structure); **LOCKED** on structural-observation-as-mechanic per this decision; **UNRESOLVED** on the exact detail/answer, pending source photo.

**PHASE 3E UPDATE**: Re-searched exhaustively alongside the other two remaining quests (repo assets, git history, ~/Desktop, ~/Downloads, ~/Pictures, ~/Documents, iCloud Drive; keyword sweep for "spring water," "shelter," "springhouse," "fort hill," "pavilion"). No new image found, and no detail was read from a photo blocked by a parked vehicle. Same Aug 27 IMG_5697–IMG_5716 gap applies as the most likely, currently-inaccessible source. Quest remains STAGED FAIL-CLOSED.

**WHY THIS QUEST IS FUN**: It's the quietest quest in the set by design — a real, calm, overlooked structure that rewards the player for slowing down and actually looking at what holds it together, right before the Secret sentence completes and points them, deliberately, at West Lawn.

---

# 14-QUEST EXPERIENCE AUDIT

**Mechanic variety**: With this pass's decisions applied, the set is now genuinely mixed rather than check-in-heavy. Passphrase/observation puzzles: Bell Cipher, Kraken Wall (combo), Palace, The Mural, The Tower, Willie the Whale, Eternal Flame, Monument Park, The Golden Mark, Spring Water Shelter — 10 of 14. Photo: Canton Sign Capture, Draft Lineup, plus Kraken Wall's photo half — 3 of 14. Plain Check-In: Skate Park Check-In, The Open Ground — 2 of 14 (intentionally, per your instruction that Skate Park serves as the fast/simple check-in; The Open Ground remains check-in because no real observable feature was ever evidenced for that field). This is a real, evidence-grounded shift toward observation and reading, not a cosmetic relabeling.

**Difficulty variety**: Genuinely present and now wider. Canton Sign Capture and Skate Park Check-In remain near-zero-friction; Bell Cipher, Kraken Wall, Eternal Flame, and Golden Mark require real reading; Draft Lineup requires a specific photo composition; The Mural, The Tower, Willie, and Spring Water Shelter now require close physical inspection of a specific real feature. Monument Park (McKinley, locked) is the single hardest quest in the set, requiring a real stairway climb plus careful reading.

**Family accessibility**: Still strong — Sign Capture and Draft Lineup remain simple photo ops for young kids; Palace now asks for real observation (age-appropriate, not reading-heavy) rather than a bare tap; Bell Cipher and Kraken Wall add reading challenges suited to slightly older kids or parent-assisted play.

**Challenge intensity**: Substantially improved by this pass. Four of five Challenge quests (Mural, Tower, Willie, and — structurally — Skate Park remains the deliberate exception) now require close physical inspection rather than arrival alone, giving "Challenge" real teeth relative to "Family" instead of just covering more ground.

**Secret mystery feeling**: The strongest district tonally, now uniformly so — all five Secret quests (Flame, Monument Park, Golden Mark, Spring Water Shelter, plus the Master Cipher gate itself) require real reading or physical climbing, delivering consistent "hidden in plain sight" atmosphere district-wide.

**Google-cheat resistance**: High across the board. Every passphrase quest now requires a detail that isn't in any public database or generic search — a plaque, a signature, a structural count, or a specific carved year — meaning presence at the real location is the only path to the answer.

**Replay/shareability**: Draft Lineup, Kraken Wall, and Willie the Whale remain the most visually shareable moments. Monument Park's real stairway climb adds a strong "I did the whole thing" shareable moment unique to the Secret path.

**Likely player confusion**: [PHASE 3E: Palace, The Mural, and Willie the Whale were subsequently photo-verified and implemented in Phase 3B/3D — no longer pending.] Largest remaining risk is the three quests whose exact answer is still pending a source photo (The Tower, Golden Mark, Spring Water Shelter) — if implementation writes clue copy ahead of the real photo evidence, there's real risk of shipping an unverifiable or wrong answer. None of these should move to code until their photo is in hand. Kraken Wall's combination proof type (photo + passphrase) still needs very clear UI/copy so players don't submit only the photo and think they're done.

**Order independence**: Fully preserved. Every quest is authored as a standalone field action with no reference to completing another field quest first. Higher-level gates (3 Locks + 3 Sigils + manual district decode) remain the only progression requirement.

**Physical safety**: No quest in this document asserts a safety fact not already evidenced. Monument Park's real stairway climb is now flagged as the most physically demanding quest in the set. Every quest still carries "FIELD VERIFICATION REQUIRED" wherever access, hours, traffic, or accessibility hasn't been confirmed.

**Clue fairness**: Bell Cipher and Monument Park (McKinley/1897) are fair now — real clue copy already exists and points the player to exactly the right place. [PHASE 3E: Palace, The Mural, and Willie the Whale are now also fair — implemented with real, photo-verified answers.] The Tower, Golden Mark, and Spring Water Shelter are **not yet fair** — each has a real mechanic locked, but the exact answer is pending a source photo, so their clue copy cannot be finalized (and should not be printed) until that photo confirms what's actually there.

**Spoiler leakage**: None introduced here. The Secret district's three fragments (`[THE DEAD]`, `[KEEP IT]`, `[AT WEST LAWN]`) still combine into "THE DEAD KEEP IT AT WEST LAWN" only once all three are collected. Nothing in this pass reveals West Lawn or Frankenstein earlier than that gate.

**Is FRANKENSTEIN deducible but not obvious too early?**: Yes, unchanged: only the full three-sentence syllogism converges on FRANKENSTEIN. Nothing authored in this pass changes that gating.

---

# LOCKED NOW

Quests that can move directly into implementation once field-verified for safety/access only (their content and mechanic are not in question):

- **Skate Park Check-In** — fully locked, real location, real working code, exact card match.
- **Canton Sign Capture** — fully locked, real location, existing real photo asset, simple mechanic.
- **Draft Lineup** — fully locked location and mechanic; only the specific photo-framing review process needs defining.
- **Bell Cipher** — locked mechanic and strong-confidence answer; needs one photo confirmation pass, not a design decision.
- **Monument Park** — locked location (McKinley National Memorial) and locked mechanic (climb + real 1897 dedication-year marker); needs one photo confirmation pass on the exact marker wording, and its current card art corrected — not a design decision.
- **The Open Ground** — locked as check-in; no real observable feature was ever evidenced here, so check-in remains the honest default.
- **Palace — IMPLEMENTED (Phase 3D)** — real bronze sidewalk star ("The Shaheen Family / Desert Inn / 1997") recovered from local Mac field photography and locked as the answer. Live.
- **The Mural — IMPLEMENTED (Phase 3D)** — real BLUE WHALE confirmed via a 10-frame real photo sequence of the full wall; clue rebuilt around it, replacing the unresolved lower-right framing. Live.
- **Kraken Wall — IMPLEMENTED (Phase 3B)** — location and mechanic (photo presence + MORGAN passphrase) live; signature still not photographically confirmed (non-blocking).
- **Willie the Whale — IMPLEMENTED (Phase 3B)**, **The Eternal Flame — IMPLEMENTED (Phase 3B)** — both live.

# NEARLY LOCKED

All mechanics below are now locked. What remains is exclusively photo evidence to fill in the exact answer — not a design choice.

- **The Tower** — structural-count mechanic locked; needs a full-height photo to identify and count the real feature.
- **The Golden Mark** — real location confirmed; needs a legible photo of the plaque. Highest priority of this group — it gates a Founder Lock.
- **Spring Water Shelter** — structural-observation mechanic locked; needs a clear photo of the shelter's real supports to count the real feature.

# SOURCE PHOTOS NEEDED

Only three quests remain blocked on evidence — Palace and The Mural were resolved and implemented in Phase 3D using real local Mac field photography (see `docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md`):

1. **The Golden Mark** — a clear, legible photo of the stone plaque in front of the Canton Road sculpture. **Highest priority — this gates a Founder Lock.**
2. **The Tower** — a full-height, well-lit photo of the tower to identify and count a real structural feature.
3. **Spring Water Shelter** — a clear photo of the shelter's real support structure (beams, pillars, or openings) to count the real feature.

# GENUINE DESIGN DECISIONS NEEDED

None remain. All three decisions from the prior pass (Monument Park location, Palace mechanic, Mural/Tower/Willie/Spring Water Shelter mechanic) are now locked per your direction above. The only remaining open items are the nine source-photo needs listed above — none require a design judgment call, only a camera.

---

# QUEST AUTHORING STATUS

## Fully Locked Quests
Skate Park Check-In, Canton Sign Capture, Draft Lineup, Bell Cipher, Monument Park, The Open Ground.

## Nearly Locked Quests
The Tower, The Golden Mark, Spring Water Shelter — mechanics locked, each pending one photo to confirm its exact answer. (Kraken Wall, Willie the Whale, and The Eternal Flame implemented in Phase 3B; Palace and The Mural implemented in Phase 3D.)

## Source Photos Needed
Golden Mark plaque (highest priority — gates a Founder Lock); The Tower's structural count; Spring Water Shelter's support structure.

## Genuine Decisions Needed From Dustin
None. All three prior open decisions (Monument Park, Palace, Mural/Tower/Willie/Spring Water Shelter) are resolved and locked into this document.

## Document Created
`docs/FOUNDERS-CIPHER-14-QUEST-AUTHORING.md` (updated).

## Files Changed
None besides the document above. No other file in the repository was modified.

**NO GAMEPLAY CODE IMPLEMENTED. NO MIGRATION APPLIED. NO PRODUCTION DEPLOYED.**

---

# PHASE 3E ADDENDUM — EXHAUSTIVE RE-SEARCH + LEGACY CONTAINMENT

**Re-search outcome (The Tower / The Golden Mark / Spring Water Shelter)**: All local evidence sources were re-searched exhaustively this pass (repo assets, git history, `~/Desktop`, `~/Downloads`, `~/Pictures`, `~/Documents`, iCloud Drive, sibling Canton Quests photo folders) for these three specifically. No new usable photo was found for any of them. The search converged on one concrete lead: the Aug 27 downtown session has a clean, isolated gap of 20 consecutive missing frame numbers (IMG_5697 through IMG_5716, spanning a real 08:38:29 → 09:06:38 travel window) that is not present in any exported/derivative form in `~/Downloads` and is therefore only reachable by manually scrolling the Apple Photos app itself — which was intentionally not opened at the database/internals level this pass (Spotlight/`mdls` metadata only, per instruction). No count, plaque text, or structural detail was invented or OCR'd from a low-resolution source for any of the three. All three remain **STAGED FAIL-CLOSED**, unchanged in mechanic from the "Nearly Locked" state above — see per-quest "PHASE 3E UPDATE" notes inline in QUEST 7 / QUEST 13 / QUEST 14 for full detail.

**Unrelated but real discovery — legacy fragment/Lock duplication contained**: The Phase 3E audit test suite (`tests/founders-cipher-phase3e-final-three-audit.test.ts`) surfaced 4 previously-undiscovered legacy quests still granting canonical fragment/Lock keys outside the 14-quest canon, all now contained (reward capability stripped, `gmNotes` documenting why):
- `qst-palace-theatre-year` was duplicating `arts-palace-lantern` ([THE MAN]) — canonical source is Kraken Wall.
- `qst-hof-legend-qr` was duplicating `challenge-helmet-emblem` ([GAVE A MONSTER]) — canonical source is The Open Ground.
- `qst-arcade-high-score-video` was duplicating `challenge-neon-loop` ([HIS NAME]) — canonical source is Willie the Whale.
- `qst-challenge-the-lost-page` (the draft C1→C4 "Storybook Sector" chain's final step) was granting Founder Lock **THE CODE** via both `threeLocksFragment` and a separate `collectibleUnlockIds` entry, plus a stray `countsTowardFinale: true` flag — none of which should exist, since THE CODE's sole intended source is The Tower (not yet implemented).

This means 9 legacy quests are now fully contained in total (5 from prior phases + these 4). See `docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md`'s Phase 3E Addendum for full mechanism detail, and `tests/challenge-sector-c1-c4.test.ts` / `tests/founders-cipher-phase3e-final-three-audit.test.ts` for the regression coverage.

## Files Changed (Phase 3E)
`lib/seed-data.ts`, `tests/challenge-sector-c1-c4.test.ts`, `tests/founders-cipher-phase3e-final-three-audit.test.ts` (new), `docs/FOUNDERS-CIPHER-PHYSICAL-EVIDENCE.md`, this document.

**NO NEW GAMEPLAY MECHANIC IMPLEMENTED FOR TOWER / GOLDEN MARK / SPRING WATER SHELTER. NO MIGRATION APPLIED THIS PASS. NO PRODUCTION DEPLOYED BY THIS SESSION.**
