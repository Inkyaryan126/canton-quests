# FOUNDER'S CIPHER — 14-QUEST ARCHAEOLOGY & RECOVERY REPORT

**Scope**: read-only. No code was written, no architecture was changed, no physical facts were invented. Every claim below is sourced to an exact file, commit, or explicitly marked as absent.

---

## 1. EXECUTIVE SUMMARY

**The single most important finding reframes the whole task**, so it goes first: the 14 quest *names* you gave me (Bell Cipher, Canton Sign Capture, Draft Lineup, Kraken Wall, Palace Check-In, The Mural, The Tower, Skate Park Check-In, The Open Ground, Willie the Whale, The Eternal Flame, Monument Park, The Golden Mark, Spring Water Shelter) **do not exist anywhere in this repository's history before today**. A full pickaxe search across all 136 commits shows every one of these names was introduced in a single commit this morning (`b386141`, 2026‑08‑31 11:26:42, message literally "YOUR COMMIT MESSAGE"), inside a brand-new design document, `docs/FOUNDERS-CIPHER-GAME-ARCHITECTURE.md`. They were not recovered from an older, richer version of the game that got simplified down to these labels — they're new labels, and in most cases the label is not yet connected to any real physical fact.

The actual direction of loss in this repo runs the **other way**. From Aug 9 through Aug 24, a genuinely detailed, real-Canton quest design existed with hard, specific answers: the Palace Theatre's real 1927 opening year, the McKinley Memorial's 108-step count, the Onesto building's brass-inscribed word ("ONESTO"), and a real 4-chapter West Lawn Cemetery puzzle chain naming actual neighboring family monuments (Wise, Reese, Miller, Black, Meyer, Dickes, Heldenbrand, Baldwin) backed by 68 real site reference photographs. Over the following two weeks, most of that specificity was progressively stripped out of the copy (though the underlying quest objects, and in some cases the original hard-coded answers, are still sitting in `lib/seed-data.ts` today) or the quest was cut from the active roster entirely.

So the honest state of the 14 canonical quests is: **a few of them have a real, recoverable physical answer sitting in the repo, not yet connected to the new canonical name. Most of them have no real content at all — just a name, a generated placeholder image (dated Aug 28), and a "FIELD VERIFICATION REQUIRED" flag in a document written this morning.** Two specific facts you told me were already decided — Kraken Wall = artist name MORGAN, Bell Cipher = real inscribed bell text — **do not appear anywhere in this repository**, in any file, in any commit, past or present. They are real to you; they are not yet real to the codebase. Both are marked `SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE` below.

**What's recoverable and strong**: Palace Theatre (1927), McKinley Memorial (108 steps + an old 1897 dedication-year answer), Onesto building (ONESTO brass word), Mother Goose Land (real mural + real "Willie" whale landmark, confirmed since Aug 18), and the entire West Lawn Cemetery finale thread (Frankenstein monument, real neighboring monument names, 68 real photos, and the finale's actual answer, `FRANKENSTEIN`, already hashed into a migration).

**What's not recoverable from this repo at all**: Eternal Flame, Golden Mark, Spring Water Shelter, Canton Sign Capture, Draft Lineup, and Kraken Wall's Morgan signature — these have zero location record, zero physical detail, and zero answer anywhere in 136 commits of history. They were named this morning and nothing else has been written about them yet.

**Also found, unprompted but load-bearing**: the design document that invented the 14 names contains at least two internal contradictions — two different old quests are each claimed as the source for both "The Mural" (Q6) and "The Tower" (Q7), and "The Golden Mark" (Q13, Secret path) is mapped to a quest physically located at 9th Street (a Challenge-district skate park), not anywhere near "Monument Park" as the same document's own Section M implies. These are flagged in Section 6, not resolved.

---

## 2. CANONICAL 14-QUEST RECOVERY TABLE

| # | Quest | Real location on file? | Real answer/detail on file? | Confidence | Best evidence source |
|---|---|---|---|---|---|
| 1 | Bell Cipher | STRONG INFERENCE (Centennial Plaza) | UNKNOWN | Low | Image gen Aug 28; doc text only, today |
| 2 | Canton Sign Capture | UNKNOWN | UNKNOWN | Very low | Doc text only, today; mapped quest is McKinley content |
| 3 | Draft Lineup | STRONG INFERENCE (Pro Football HOF area) | UNKNOWN | Low | Real HOF marker exists since day 1; mechanic invented today |
| 4 | Kraken Wall | STRONG INFERENCE (Arts/Family mural) | **UNKNOWN — "MORGAN" not in repo** | Low | Octopus mural image existed Aug 10 (deleted), reappeared Aug 28 |
| 5 | Palace Check-In | **VERIFIED** (605 Market Ave N) | **VERIFIED — opening year 1927** | High | `5282f03` (Aug 9), refined `e6986d0` (Aug 23) |
| 6 | The Mural | **VERIFIED** (Mother Goose Land, 714 12th St NW) | STRONG INFERENCE ("BLUE WHALE" from a retired draft chain) | Medium | `e6986d0`; draft C1 `qst-challenge-blue-signal` |
| 7 | The Tower | **VERIFIED** (Mother Goose Land silo) | UNKNOWN (band count never recorded) | Medium | `191fef8` (Aug 24) |
| 8 | Skate Park Check-In | **VERIFIED** (9th St Skate Corridor) | N/A (check-in only) | High | `191fef8` (Aug 24) |
| 9 | The Open Ground | UNKNOWN | UNKNOWN | Very low | Location added today, no precursor |
| 10 | Willie the Whale | **VERIFIED** (Mother Goose Land, named landmark since Aug 18) | UNKNOWN (no puzzle ever written) | Medium-High | `ffa2b73` (Aug 18) visual-assets-manifest.md |
| 11 | The Eternal Flame | UNKNOWN | UNKNOWN | Very low | Doc text only, today; no location record ever |
| 12 | Monument Park | **VERIFIED** (McKinley National Memorial, 800 McKinley Monument Dr NW) | **VERIFIED — 108 steps; old answer target 1897** | High | `5282f03` (Aug 9) |
| 13 | The Golden Mark | UNKNOWN | UNKNOWN | Very low | Doc text only, today; conflicts with Onesto ("ONESTO") mapping elsewhere |
| 14 | Spring Water Shelter | UNKNOWN | UNKNOWN | Very low | Doc text only, today; no location record ever |

---

## 3. DETAILED EVIDENCE — ALL 14 QUESTS

### 1. Bell Cipher (Family — Founder Lock "THE WORD")
- **Intended mechanic**: "Physical Extraction" — read text off a real bell. *Source*: `docs/FOUNDERS-CIPHER-GAME-ARCHITECTURE.md`, Section M/N/O (all added today, `b386141`).
- **Clue concept**: "Verify exact raised lettering/inscribed year on bell fixture; confirm readable from public sidewalk." Same source.
- **Known answer/passphrase**: none committed anywhere.
- **Proof type**: not yet specified beyond "Physical Extraction" (likely `passphrase`, unconfirmed).
- **Location**: named only as "Centennial Bell" — no `SEED_LOCATIONS` entry, no address. Strong inference it's meant to sit at Centennial Plaza (the Family district's existing hub), since that's the only real location cluster the Family path already has.
- **Source image/file**: `public/canton-quests/quests/family/bell.png` — this file's own generation timestamp is 2026-08-28 12:50:38 PM (originally `ChatGPT Image Aug 28, 2026, 12_50_38 PM.png`, renamed in commit `9db3b0e`). Not yet wired into `lib/marketing-assets.ts`.
- **Physical detail being used**: an as-yet-unspecified real bell inscription.
- **Founder Cipher role**: Founder Lock #1, THE WORD.
- **Confidence**: **STRONG INFERENCE** on location, **UNKNOWN** on the actual inscription.
- **Evidence source**: `docs/FOUNDERS-CIPHER-GAME-ARCHITECTURE.md` (today only); image file metadata.
- **Unresolved**: the real bell and its text — you told me this exists ("substantial real text beneath/on it"), but it is not in this repository in any form. **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.**

### 2. Canton Sign Capture (Family — District Evidence, fragment `[A NAME]`)
- **Intended mechanic**: "Perspective Framing Photo." *Source*: architecture doc, today only.
- **Clue concept**: none beyond the mechanic label.
- **Known answer**: none.
- **Proof type**: implied photo, unconfirmed.
- **Location**: no `SEED_LOCATIONS` entry anywhere for a "Canton sign." The legacy-containment doc maps this canonical slot to `qst-mckinley-cipher` (McKinley Monument content) — which is a location mismatch, not a "Canton sign" at all. Flagged in Section 6.
- **Source image/file**: `public/canton-quests/quests/family/canton.png` (generated Aug 28, renamed `9db3b0e`).
- **Physical detail being used**: none recorded.
- **Founder Cipher role**: District Evidence, Arts fragment 1.
- **Confidence**: **UNKNOWN**.
- **Evidence source**: architecture doc only; image filename.
- **Unresolved**: what physical "Canton sign" this refers to (there's a real "Canton" city entry sign, a plaza sign, downtown signage — repo doesn't say which). **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE** if you have a specific sign in mind.

### 3. Draft Lineup (Family — District Evidence, fragment `[OUTLIVES]`)
- **Intended mechanic**: "Missing-Position Align." *Source*: architecture doc, today only.
- **Clue concept**: "Verify exact stanchion count, player silhouette arrangement, and physical marker text." Same source, Section O.
- **Known answer**: none.
- **Location**: no direct record for "Draft Lineup," but the football imagery and theme strongly point at the real, long-standing **Hall of Fame City Marker**, `2121 George Halas Dr NW, Canton, OH 44708` — present since the very first commit (`5282f03`, Aug 9) as *"Commemorative plaza marker celebrating Canton football heritage."* Note: that real location's existing quest, "The Helmet Trail Emblem," is a **Challenge**-path QR scavenger stop, not a Family-path stanchion/silhouette puzzle — today's doc reassigns the football theme to a different path and a different mechanic than anything ever built for it.
- **Source image/file**: `public/canton-quests/quests/family/football.png` (generated Aug 28, renamed `9db3b0e`). A *separate*, older `public/canton-quests/football.png` (top-level, added Aug 18) was explicitly tagged in the visual-assets manifest as *"Challenge path / Helmet Trail quest backdrop."*
- **Physical detail being used**: "stanchion count" and "player silhouette arrangement" are named as things to verify, not confirmed facts — no count is on record anywhere.
- **Founder Cipher role**: District Evidence, Arts fragment 2.
- **Confidence**: **STRONG INFERENCE** on the location (HOF marker area), **UNKNOWN** on the actual mechanic/answer.
- **Evidence source**: `5282f03` (real HOF location); architecture doc (today, mechanic).
- **Unresolved**: whether "Draft Lineup" is meant to reuse the real HOF City Marker site, or is a genuinely new/different location. **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE** for any real stanchion/silhouette display at that site.

### 4. Kraken Wall (Family — District Evidence, fragment `[THE MAN]`)
- **Intended mechanic**: "Detailed Mural Observation." *Source*: architecture doc, today.
- **Clue concept**: inspect a mural closely enough to find a detail (per your brief: the artist's signature, MORGAN).
- **Known answer**: **your stated answer, MORGAN, does not appear anywhere in this repository** — a full case-insensitive pickaxe search across all 136 commits, every file type, returns zero hits. This is not lost history; it was never committed here in the first place.
- **Proof type**: unconfirmed, likely `passphrase`.
- **Location**: no address ever recorded. A real octopus mural image existed once before — `public/canton-quests/octopus-mural.png`, added Aug 10 (`b5737bc`) as generic "Arts District Murals" showcase art, deleted 13 hours later the same day (`d56a629`, no explanation given) — then reappeared 18 days later as the current `octo.png` (generated Aug 28). Neither instance was ever tied to a specific street address.
- **Source image/file**: `public/canton-quests/quests/family/octo.png` (generated Aug 28, renamed `9db3b0e`).
- **Physical detail being used**: an octopus/kraken mural; the specific artist signature is not recorded.
- **Founder Cipher role**: District Evidence, Arts fragment 3 (supersedes the old `qst-aura-coffee-qr` per the containment doc).
- **Confidence**: **STRONG INFERENCE** that this is a real Canton mural (the octopus imagery recurs twice, independently, months apart, suggesting it's grounded in something real you've seen), **UNKNOWN** for the exact wall/address/signature.
- **Evidence source**: `b5737bc`/`d56a629` (Aug 10 octopus mural add/delete); image regeneration Aug 28.
- **Unresolved**: the mural's real location and the MORGAN signature. **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.**

### 5. Palace Check-In (Family — Optional Anomaly)
- **Intended mechanic (today's doc)**: "GPS Check-In + Audio," downgraded to a passive optional Watcher anomaly.
- **REAL PRIOR MECHANIC (recovered)**: this location has a real, specific, historically-accurate answer that predates today's doc by three weeks and was never actually deleted from the design lineage, only softened in wording. The original quest (`5282f03`, Aug 9) hard-coded:
  > `targetCode: '1927'` — *"Discover the original opening year of the historic Canton Palace Theatre... What year did the Palace Theatre open?"*

  This is a real, verifiable historical fact (the Canton Palace Theatre's actual opening year). It survived into the current `qst-palace-theatre-year` quest, refined (`e6986d0`, Aug 23) to: *"Find the four-digit year displayed on the exterior of the building itself — not a sign or poster, but part of the structure."* **The quest currently live in `lib/seed-data.ts` still asks for this exact four-digit year** — the mechanic was never actually lost, only the copy was made less specific over time.
- **Location**: **VERIFIED** — Canton Palace Theatre, 605 Market Ave N, Canton, OH 44702.
- **Source image/file**: `public/canton-quests/quests/family/palace.png` (generated Aug 28), plus an older, separate `public/canton-quests/palace.png` (Aug 18) already wired as the Palace Theatre destination card.
- **Physical detail being used**: a four-digit year built into the theatre's exterior structure (not a sign) — **1927**, per the earliest recorded version of this quest.
- **Founder Cipher role**: today's doc reduces this to an optional Watcher-lore anomaly, superseding the old `qst-arcade-high-score-video`.
- **Confidence**: **VERIFIED PREVIOUS DESIGN.**
- **Evidence source**: `5282f03` (2026-08-09, original hardcode); `e6986d0` (2026-08-23, refined instructions); current `lib/seed-data.ts:797` (`qst-palace-theatre-year`, still live).
- **Unresolved**: none about the fact itself — but today's doc doesn't reuse it (it repurposes Palace Check-In as a passive audio anomaly instead of a puzzle), which is a design choice worth revisiting given a real, dated, verifiable answer already exists here.

### 6. The Mural (Challenge — District Evidence, fragment `[THE WORLD]`)
- **Intended mechanic**: "Spatial Layout Observation." *Source*: architecture doc, today.
- **Location**: **VERIFIED** — Mother Goose Land, 714 12th St NW, Canton, OH 44703, present since `e6986d0` (Aug 23): *"Historic Canton park featuring large illustrated mural walls and nostalgic storybook character landmarks."*
- **Currently live quest** (`qst-challenge-the-mural`, added today): a bare check-in with no puzzle — *"Locate the painted mural wall at Mother Goose Land and inspect the characters hidden across the scene."* No answer.
- **REAL prior riddle content that exists but is slated for retirement**: a draft "Storybook Sector" chain (`2d588e5`, Aug 24, `status: 'draft'`, explicitly flagged for removal by today's doc) contains a real, hashed answer for the same mural:
  > `qst-challenge-blue-signal` "The Blue Signal": *"The Mother Goose Land mural wall still carries a large blue creature from the old storybook scenes. What large blue creature appears on the mural?"* — accepted answers (from code comments on the hash): **BLUE WHALE** / **A WHALE**.
- **A second, separate riddle also exists** for the same wall in the currently-active (non-draft) `qst-goose-land-cipher`: *"What is the character in the lower right section of the wall holding?"* — this answer was **never committed in plaintext** anywhere; gmNotes explicitly flags it as unconfirmed.
- **Source image/file**: `public/canton-quests/quests/challenge/mother_mural.png` (`goosewall.png` is the older top-level equivalent, Aug 18).
- **Founder Cipher role**: District Evidence, Challenge fragment 1. **Note**: two different legacy quests (`qst-palace-theatre-year` and `qst-challenge-the-mural`) are both claimed as the source for this same canonical slot in the containment doc — see Section 6.
- **Confidence**: **VERIFIED** on location; **STRONG INFERENCE** on the "BLUE WHALE" answer (real, hashed, committed — but attached to a quest marked for retirement, and possibly a different mural detail than the still-unanswered "lower right character" riddle).
- **Evidence source**: `e6986d0` (location); `2d588e5` (draft answer); current `lib/seed-data.ts` (`qst-goose-land-cipher`, unanswered riddle).
- **Unresolved**: whether "BLUE WHALE" and "the character in the lower right" are the same clue or two different clues on the same mural wall.

### 7. The Tower (Challenge — Founder Lock "THE CODE")
- **Intended mechanic**: "Vertical Tier Extraction" — count physical bands/openings on a silo. *Source*: architecture doc, today, Section O: *"Count physical structural bands/openings on the silo tower from outside perimeter fence."*
- **Location**: **VERIFIED** — a real storybook silo/tower structure at Mother Goose Land, 714 12th St NW, added `191fef8` (Aug 24): *"Historic storybook silo/tower landmark standing over Mother Goose Land."*
- **Currently live quest** (`qst-challenge-the-tower`): a bare check-in, no counting mechanic implemented — *"Locate the storybook silo tower in Mother Goose Land and check in to register the landmark signal."*
- **Known answer**: none — no band/tier count has ever been recorded anywhere.
- **Source image/file**: `public/canton-quests/quests/challenge/silo.png` (added directly Aug 31, not a ChatGPT rename — this one may be a real or higher-fidelity asset, worth checking).
- **Founder Cipher role**: Founder Lock #2, THE CODE.
- **Confidence**: **VERIFIED** on location/structure; **UNKNOWN** on the tier count.
- **Evidence source**: `191fef8` (location); architecture doc (mechanic).
- **Unresolved — important**: the containment doc separately claims THE CODE / "Q07: The Tower" is sourced from a *completely different* quest, `qst-onesto-brass-motto` (the Onesto building's brass-word cipher, downtown, nowhere near Mother Goose Land). Two real, unrelated locations are both claiming this one canonical slot. See Section 6.

### 8. Skate Park Check-In (Challenge — Optional Anomaly)
- **Intended mechanic**: "GPS Check-In + Log," framed today as a passive Watcher anomaly ("passive monitoring node").
- **Location**: **VERIFIED** — 9th Street Skate Corridor, 9th St NW, Canton, OH 44703 (lat 40.8060 / lon -81.3870), added `191fef8` (Aug 24).
- **Currently live quest** (`qst-9th-street-opening`, "The 9th Street Signal"): a real, working GPS check-in, unchanged in substance since Aug 24 — *"Report to the 9th Street Skate Corridor at 9th St NW and check in to activate your Challenge district field log."*
- **Known answer**: none needed — this is a check-in, not a puzzle.
- **Source image/file**: `public/canton-quests/quests/challenge/skate_park.png`.
- **Founder Cipher role**: Optional Anomaly B (Watcher passive node) — narrative dressing only, not a real mechanic change.
- **Confidence**: **VERIFIED PREVIOUS DESIGN.**
- **Evidence source**: `191fef8` (Aug 24); current `lib/seed-data.ts:1293`.
- **Unresolved**: this same location/quest ID is *also* claimed by the containment doc as the source for Q13 "The Golden Mark" (a Secret-path quest) — see Section 6.

### 9. The Open Ground (Challenge — District Evidence, fragment `[GAVE A MONSTER]`)
- **Intended mechanic**: "Perimeter Feature Observation." *Source*: architecture doc, today.
- **Location**: added today (`b386141`) — `loc-challenge-field`, "Challenge Field," 9th St NW & Shriver Ave NW, Canton, OH 44703. No precursor found anywhere before today.
- **Currently live quest** (`qst-challenge-open-ground`): bare check-in — *"Cross into the open ground field. Scan the area and confirm your field position..."*
- **Known answer**: none.
- **Source image/file**: `public/canton-quests/quests/challenge/the_open_ground.png`.
- **Founder Cipher role**: District Evidence, Challenge fragment 2.
- **Confidence**: **UNKNOWN.**
- **Evidence source**: `b386141` only.
- **Unresolved**: "identify permanent perimeter landmark" (per Section O) — no landmark is named anywhere. **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE** if you have a specific field/landmark in mind for this location.

### 10. Willie the Whale (Challenge — District Evidence, fragment `[HIS NAME]`)
- **Intended mechanic**: "Physical Structure Observation." *Source*: architecture doc, today.
- **Location & landmark**: **VERIFIED, and the strongest single non-Palace/Monument recovery in this report.** `docs/visual-assets-manifest.md`, added `ffa2b73` (Aug 18) — 13 days before today's renaming — already names "Willie" as a real, specific landmark: *"Mother Goose Land Whale / Willie Art ... Challenge zone kinetic landmark."* The same file's own stated invariant: *"Real Geography Preserved: ... Mother Goose Land / Willie is in Challenge."* This confirms Willie is a real, physical whale landmark (the manifest calls it "kinetic," implying a structure/sculpture, not just a painted image) that this project has known about and referenced consistently for two weeks before today's redesign.
- **Currently live quest** (`qst-goose-land-cipher`, mapped here per the containment doc): asks about a mural detail, not explicitly "Willie" by name.
- **Known answer**: none — no puzzle has ever been written asking the player to identify or interact with Willie specifically.
- **Source image/file**: `public/canton-quests/quests/challenge/willie.png`; older `goosewillie.png` (Aug 18, 819×707 PNG).
- **Physical detail being used**: unclear whether "Willie" is (a) a physical whale statue/slide at Mother Goose Land, or (b) the painted whale on the mural wall (the "BLUE WHALE" answer from Quest 6's draft chain). Both concepts exist in the repo and may or may not be the same thing.
- **Founder Cipher role**: District Evidence, Challenge fragment 3 (`[HIS NAME]` — fitting, since the quest is literally about a named whale).
- **Confidence**: **VERIFIED** that Willie is real and at Mother Goose Land; **UNKNOWN** what the actual quest mechanic/answer should be.
- **Evidence source**: `ffa2b73` (Aug 18, visual-assets-manifest.md).
- **Unresolved**: statue vs. mural-painting ambiguity — flagged, not resolved.

### 11. The Eternal Flame (Secret — District Evidence, fragment `[THE DEAD]`)
- **Intended mechanic**: "Bronze Dedication Cipher." *Source*: architecture doc, today, Section O: *"Verify exact wording and dates on the permanent bronze dedication plaque."*
- **Location**: **NOTHING FOUND** — no `SEED_LOCATIONS` entry, no address, in any commit, ever.
- **Known answer**: none.
- **Source image/file**: `public/canton-quests/quests/secret/flame.png` — present in the working tree, not wired into `lib/marketing-assets.ts`.
- **Founder Cipher role**: District Evidence, Secret fragment 1 (containment doc maps this to the already-inactive `qst-founders-secret-clue`, which has zero flame-related content — see Section 6).
- **Confidence**: **UNKNOWN.**
- **Evidence source**: architecture doc only.
- **Unresolved**: what and where this eternal flame physically is. **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.**

### 12. Monument Park (Secret — District Evidence, fragment `[KEEP IT]`)
- **Intended mechanic**: "Multi-Stage Spatial Path." *Source*: architecture doc, today, Section O: *"Walk stone stairway; verify step counts, landing markings, and ADA ramp alternatives."*
- **Location**: **VERIFIED** — McKinley National Memorial, 800 McKinley Monument Dr NW, Canton, OH 44708. Present since the very first commit (`5282f03`, Aug 9).
- **REAL PRIOR DETAIL (recovered)**: the original location record explicitly stated:
  > `locationNotes: 'Historic 108-step monument overlooking the park and city.'`

  This exact "108-step" detail was present through `0200e9a` (Aug 13) and was **dropped** by `e6986d0` (Aug 23), where the copy was generalized to just *"Historic monument overlooking the park and city."* This is a real, specific, verifiable physical fact (the memorial's actual step count) that the current codebase and today's field-verification checklist are effectively asking to re-discover — it was already known and written down three weeks ago.
- **REAL PRIOR ANSWER (recovered)**: the original quest here (`5282f03`, Aug 9) hard-coded:
  > `targetCode: '1897'` — *"Find the dedication year engraved on the bronze cornerstone of the McKinley Memorial."*

  This survived, reworded, into the current live quest (`qst-mckinley-cipher`, "The Stone Stair Cipher"): *"The year is on stone, facing the path — it marks when something was dedicated, not a birth or death year. Stand at the base of the stairs and look at the markers around you."* The quest still asks for a four-digit year; **1897 is the original recorded target**, though the current `gmNotes` explicitly say to "reconfirm plaque wording and target marker before printing clue cards" — meaning even the prior authors weren't fully certain this was final.
- **Source image/file**: `public/canton-quests/monument.png` (Aug 18) — tagged "McKinley National Memorial Art ... Secret zone / Monument Park destination card," confirming this identification independently.
- **Founder Cipher role**: District Evidence, Secret fragment 2 (containment doc maps this slot instead to `qst-civic-seal-photo`, an inactive, contentless Centennial Plaza photo quest — see Section 6).
- **Confidence**: **VERIFIED PREVIOUS DESIGN** — the strongest, most complete recovery in this whole report.
- **Evidence source**: `5282f03` (Aug 9, original location + answer); `0200e9a` (Aug 13, still present); `e6986d0` (Aug 23, detail dropped from copy, quest mechanic kept).
- **Unresolved**: whether 108 steps / 1897 are still accurate today (gmNotes itself flags this as unconfirmed) — but they are the real, previously-recorded design, not an invention.

### 13. The Golden Mark (Secret — Founder Lock "THE MARK")
- **Intended mechanic**: "Silhouette Geometry Match." *Source*: architecture doc, today, Section O: *"Identify exact geometric brass/stone emblem; test silhouette viewing angle."*
- **Location**: **NOTHING FOUND** in git history before today. Section M of the same doc calls it *"Monument Park geometry/silhouette match,"* implying it's physically at/near the McKinley Memorial — but the containment doc's inventory table separately maps this canonical slot to `qst-9th-street-opening` (the 9th Street Skate Park check-in, a Challenge-district location). These two documents disagree with each other about where this quest even is.
- **Known answer**: none.
- **Closest real precedent (not the same thing)**: the Onesto building's brass entrance-word cipher has a real recorded answer:
  > Original hardcode (`5282f03`, Aug 9): `targetCode: 'ONESTO'` — *"Find the capitalized single word inscribed in stone above the historic entrance transom. (Hint: 'ONESTO')"*

  Refined `e6986d0` (Aug 23): *"Find the single word inscribed in the metalwork — it is not a name, but a word that describes what a building or institution aspires to be."* This quest is already assigned to Founder Lock THE CODE elsewhere (both in the containment doc and per its own `rewardConfig.threeLocksFragment: { lock: 'code' }` in current `lib/seed-data.ts`), so it cannot also be "The Golden Mark"/THE MARK without a real conflict.
- **Source image/file**: `public/canton-quests/quests/secret/"the golden mark.png"` — note the filename itself is an outlier (contains spaces and lowercase "the," unlike every sibling file), suggesting it was added in a hurry or separately from the rest of the batch.
- **Founder Cipher role**: Founder Lock #3, THE MARK.
- **Confidence**: **UNKNOWN.**
- **Evidence source**: architecture doc only; conflicts with containment doc.
- **Unresolved**: real location, real emblem, real answer — none exist in this repo. **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.**

### 14. Spring Water Shelter (Secret — District Evidence, fragment `[AT WEST LAWN]`)
- **Intended mechanic**: "Structural Count Cipher." *Source*: architecture doc, today, Section O: *"Count structural timber pillars and roof rafters at the historic springhouse."*
- **Location**: **NOTHING FOUND** — no `SEED_LOCATIONS` entry, no address, ever. A pickaxe search for "springhouse" across all history returns only today's commit. The architecture doc's Section C.6 (cellular signal risk) groups *"Spring Water Shelter or West Lawn"* together with *"Waterworks Park / Mother Goose Land,"* which is a suggestive but not confirmed link to Waterworks Park.
- **Known answer**: none.
- **Source image/file**: `public/canton-quests/quests/secret/water.png`.
- **Founder Cipher role**: District Evidence, Secret fragment 3 (the final piece of the Secret sentence, `[AT WEST LAWN]` — this fragment directly names the finale location, which is deliberate per the design's own "clue leak" mitigation discussion).
- **Confidence**: **UNKNOWN.**
- **Evidence source**: architecture doc only.
- **Unresolved**: whether a real historic springhouse exists in/near Waterworks Park with a countable pillar/rafter structure. **SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.**

---

## 4. EXACT MECHANICS/ANSWERS ALREADY RECOVERED (the short list)

These are the only genuinely real, specific, previously-decided facts found anywhere in the repository's history:

1. **Palace Theatre opening year: `1927`** — hardcoded answer, `5282f03` (Aug 9). Still the live quest's mechanic today, just with the number no longer stated in the copy.
2. **McKinley Memorial: 108 steps** — `locationNotes`, `5282f03` (Aug 9), dropped from copy by `e6986d0` (Aug 23) but never contradicted.
3. **McKinley Memorial dedication year: `1897`** — hardcoded answer, `5282f03` (Aug 9). Still the live quest's mechanic today (a four-digit year from a stone marker), just unconfirmed as still-accurate by the current `gmNotes`.
4. **Onesto building brass word: `ONESTO`** — hardcoded hint, `5282f03` (Aug 9). Reads as a likely placeholder/dummy value rather than a final creative answer (the building's own name as its own answer), but it is what's committed.
5. **Master Cipher final answer: `FRANKENSTEIN`** — sha256-hashed in `supabase/migrations/20260831120000_founders_cipher_phase2_manual_decode_reconciliation.sql`, added today. Not one of the 14, but the finale they all feed into.
6. **Finale destination text**: *"Convergence Complete. The Founder's Cipher has been solved. Report to Centennial Plaza Founder Obelisk for live verification."* — same migration. Introduces a "Founder Obelisk" at Centennial Plaza not mentioned anywhere else — worth reconciling with Bell Cipher's likely Centennial Plaza location.
7. **Mother Goose Land mural — draft answer `BLUE WHALE`** (also accepts `A WHALE`) — hashed, `2d588e5` (Aug 24), attached to a quest currently marked for retirement.
8. **West Lawn Cemetery real neighboring monument surnames**: Wise, Reese, a Civil War soldier, Miller, Black, Meyer, Dickes, Heldenbrand, Baldwin, Pallus — `191fef8` (Aug 24), backed by 68 real reference photographs (`public/canton-quests/quests/west-lawn-cemetary/raw/west-lawn-001.jpg` through `-068.jpg`). Not one of the 14, but the richest single body of real, specific content in the repo, and directly adjacent to the finale.

Everything else asked for in the 14 quests — Bell inscription, MORGAN, Canton Sign, Draft Lineup silhouette count, Tower band count, Open Ground landmark, Eternal Flame plaque wording, Golden Mark emblem, Spring Water Shelter pillar/rafter count — **has no recorded answer anywhere in this repository.**

---

## 5. EXISTING SOURCE PHOTOS WE STILL NEED TO LOCATE

Per your instruction, these are flagged as likely existing in your own photo archive rather than requiring a new site visit:

- **Bell Cipher** — a photo of the actual bell and its inscribed text (Centennial Plaza, presumed).
- **Canton Sign Capture** — a photo of whichever "Canton" sign this refers to.
- **Draft Lineup** — a photo of the stanchion/silhouette display, if it exists at the Hall of Fame City Marker area.
- **Kraken Wall** — a photo of the octopus/kraken mural clearly showing the MORGAN signature.
- **The Open Ground** — a photo of the "permanent perimeter landmark" at Challenge Field.
- **The Eternal Flame** — a photo of the flame monument and its bronze dedication plaque.
- **The Golden Mark** — a photo of the brass/stone emblem this quest is meant to use.
- **Spring Water Shelter** — a photo of the historic springhouse, ideally showing the timber pillars/rafters clearly enough to count.

For all eight of these: `SOURCE PHOTO NEEDED FROM EXISTING PHOTO ARCHIVE.`

---

## 6. GENUINELY UNRESOLVED ITEMS (not resolved here — flagged only)

1. **"The Mural" (Q6) is claimed by two different legacy quests** in the containment doc's own inventory table: `qst-palace-theatre-year` ("Reused for Challenge Fragment 1") and `qst-challenge-the-mural` ("Mother Goose mural observation awarding [THE WORLD]"). These are two different real locations (Palace Theatre downtown vs. Mother Goose Land). Only one can be right.
2. **"The Tower" (Q7) is claimed by two different legacy quests**: `qst-onesto-brass-motto` (downtown Onesto building) and `qst-challenge-the-tower` (Mother Goose Land silo). These are two different real, unrelated physical locations.
3. **"The Golden Mark" (Q13) has a location conflict between two governing documents**: the architecture doc's Section M implies it's at Monument Park (McKinley Memorial), while the containment doc's inventory table maps it to `qst-9th-street-opening` (9th Street Skate Park, a Challenge-district location, already separately assigned to Q8).
4. **Willie the Whale — statue or mural?** The visual-assets-manifest.md calls Willie a "kinetic landmark" (implying a physical structure), but the only real riddle content at the same site ("BLUE WHALE") is about a painted mural detail, not an interactive structure. These may be the same whale described two different ways, or two different things.
5. **Football/HOF theme reassignment**: the real Hall of Fame City Marker location and its football imagery were originally bound to a Challenge-path quest ("Helmet Trail Emblem"); today's doc reassigns football-themed content to a Family-path quest ("Draft Lineup") with a different mechanic. Whether this is intentional or a naming collision during today's redesign is not stated anywhere.
6. **Event date inconsistency** (not one of the 14, but adjacent): the main Founder's Cipher event's own seed data and its field-verification checklist disagree with each other about the launch date (one references Sept 4-7, another references "September 11, 2026" in the same file's copy).
7. **MORGAN and the Bell text**: confirmed absent from this repository in every form searched. Not a contradiction — just confirmed missing, sourced externally to you.

---

## 7. LEGACY QUEST CONCEPTS THAT MUST NOT BE CONFUSED WITH THE NEW 14

These are real, separately-designed, already-built quests/systems that are **not** among the 14 and should stay conceptually distinct:

- **The West Lawn Cemetery 4-chapter chain** (`qst-frankenstein-west-lawn`, `qst-watchers-first`, `qst-watchers-silent-court`, `qst-watchers-lost`) — a real, richly detailed puzzle naming actual neighboring cemetery monuments, backed by 68 real photos. This is the **finale objective and its build-up**, not one of the 14 field quests, and today's architecture doc explicitly plans to retire/replace it with the simpler "3 Locks + 3 Sigils → FRANKENSTEIN" convergence (not yet executed — all four quests remain `status: 'active'` in the current codebase).
- **`qst-secret-cipher-77` ("The Founder's Three Locks")** — an old standalone endgame quest, superseded by the new Master Cipher engine (`lib/finale.ts`). Not one of the 14.
- **`qst-grand-finale-cipher` ("Grand Finale Cipher")** — an old prototype finale quest, superseded by the server-authoritative `/api/game/finale` endpoint. Not one of the 14.
- **The draft "Storybook Sector" C1–C4 chain** (`qst-challenge-blue-signal`, `qst-challenge-storybook-witness`, `qst-challenge-what-survived`, `qst-challenge-the-lost-page`) — a real, linear, `status: 'draft'` prototype with genuine hashed answers (BLUE WHALE, DETECTIVE CAT, GINGERBREAD, A WOLF, and the combined `WHALE-CAT-GINGERBREAD-WOLF`). Explicitly slated for retirement because it violates the free-order rule. Its Q1 answer content is the same real fact referenced in Quest 6 above — don't treat it as a fifteenth quest.
- **The old `finale_qualifications` / prize-drawing "finale-qualified" system** — a completely separate, older ticket-eligibility mechanism, unrelated to the Master Cipher. (Documented in an earlier audit this session; not part of this report's scope, flagged here only so it isn't confused with the real 14.)
- **`qst-founders-secret-clue` and `qst-civic-seal-photo`** — both already `status: 'inactive'`, both generic Centennial Plaza content with zero connection to "Eternal Flame" or "Monument Park" despite being nominally mapped to those slots in the containment doc. Treat that mapping as administrative bookkeeping, not real content transfer.

---

## 8. RECOMMENDED FINAL AUTHORING ORDER

Based purely on how much real groundwork already exists for each quest (not a redesign recommendation — just sequencing the work by how much is already known):

1. **Monument Park** (Q12) — reconfirm 108 steps / 1897 on-site; content is otherwise essentially done.
2. **Palace Check-In** (Q5) — reconfirm 1927; decide whether to keep it as a real puzzle (as originally designed) or the new passive-anomaly framing.
3. **Skate Park Check-In** (Q8) — already a working, real check-in; only the Watcher-anomaly flavor text needs writing.
4. **Willie the Whale** (Q10) — location is certain; needs one real decision (statue vs. mural) and one new riddle written.
5. **The Mural** (Q6) — location is certain; resolve whether "BLUE WHALE" is the intended answer or a new riddle is needed, and resolve the double-mapping in Section 6.
6. **The Tower** (Q7) — location is certain (Mother Goose Land silo); needs an actual band/tier count from a site visit, and resolve the double-mapping with Onesto.
7. **Draft Lineup** (Q3) and **Kraken Wall** (Q4) — real imagery exists and a location is inferable, but need you to supply the actual physical facts (stanchion count; MORGAN + mural address) from your photo archive.
8. **Bell Cipher** (Q1) — needs the actual bell photo/inscription from your archive; location is a reasonable guess (Centennial Plaza) but unconfirmed.
9. **Canton Sign Capture** (Q2), **The Open Ground** (Q9), **The Eternal Flame** (Q11), **The Golden Mark** (Q13), **Spring Water Shelter** (Q14) — no real content exists for any of these yet; each needs a location decision and physical detail from scratch (or from your archive) before it can be written at all.

---

## WHAT I RECOVERED VS. WHAT'S STILL MISSING

**Recovered, with real sourced facts**: Monument Park (108 steps, 1897 dedication year), Palace Check-In (1927 opening year), Skate Park Check-In (real working location), The Mural and The Tower (real location, Mother Goose Land, though answer content is thin or contested), Willie the Whale (confirmed real landmark since Aug 18, no puzzle yet), plus the entire West Lawn/Frankenstein finale thread and its `FRANKENSTEIN` answer.

**Confirmed absent from the repository, needs to come from you**: the MORGAN signature and Kraken Wall's exact location; the Bell Cipher inscription and its exact location; and essentially all real content for Canton Sign Capture, Draft Lineup's exact detail, The Open Ground, The Eternal Flame, The Golden Mark, and Spring Water Shelter — these six/seven have a generated placeholder image and a one-line mechanic description written this morning, and nothing else.

**Flagged, not resolved**: two internal double-mappings in the design documents themselves (Q6 and Q7 each claimed by two different real locations), and a location conflict for Q13. These need a decision from you, not an invented fix from me.

Full detail for all 14 is in [docs/FOUNDERS-CIPHER-14-QUEST-RECOVERY.md](docs/FOUNDERS-CIPHER-14-QUEST-RECOVERY.md).
