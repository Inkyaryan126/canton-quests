# Canton Quests — Game System & Mechanics Engine

---

## 1. Overview & Engine Architecture

The Canton Quests Game System governs how events are structured, how players progress, how quests unlock, how scoring is calculated, and how winners are determined across diverse player commitment levels.

The engine relies on a dynamic state machine operating on three levels:
1. **Event State**: Active weekend windows, global flash events, phase shifts.
2. **Quest State**: Locked, Available, In-Progress, Submitted, Verified, Expired.
3. **Player State**: XP, category points, inventory/collectibles, active quest log, team link.

---

## 2. Weekend Event Structure

A typical Canton Quests event operates over a 3-day weekend:

```
[Friday 6:00 PM]  ──> Opening Launch & Mystery Reveal
[Saturday 9:00 AM] ──> Full City Exploration & Main Quest Chains
[Saturday 3:00 PM] ──> Pop-Up Flash Events & Business Partner Drops
[Sunday 10:00 AM] ──> Finale Sprint & Secret Clue Unlocks
[Sunday 4:00 PM]  ──> Event Finale & Awards Ceremony
```

### Event Phases
- **Pre-Event (Teaser Phase)**: Cryptic clues released on social media/app; starting zone coordinates announced.
- **Active Phase**: All core quests, flash missions, and live checkpoints are active in Canton.
- **Finale Sprint**: High-value puzzle solutions and sprint quests unlock during the final 3 hours.
- **Post-Event (Ceremony & Review)**: Scoring finalized; leaderboard locked; awards and prizes distributed.

---

## 3. Quests, Chains, & Mission Types

### 3.1 Quest Structure
A **Quest** is composed of one or more **Missions** (steps).
- **Standalone Quests**: Single-objective missions (e.g. "Find the statue in Central Plaza").
- **Quest Chains**: Multi-step sequential missions where completing Step $N$ reveals the location or code for Step $N+1$.
- **Branching Quests**: Missions where player choices dictate which branch unlocks next.

### 3.2 Verification & Proof Types
- **QR Code Scanning**: Scanning hidden physical weather-resistant QR codes at partner/public locations.
- **GPS Geo-Fence Check**: Mobile GPS validation within a specified radius (e.g., 20 meters).
- **Passphrase / Text Input**: Entering a code found on a sign, plaque, menu, or monument.
- **Photo / Video Submission**: Uploading visual proof (e.g. team high-five with a mural) verified via automated checks or admin queue.
- **NFC / Beacon Interaction**: Optional physical tap for high-tier sponsor locations.

---

## 4. Scoring Engine & Partial-Weekend Equity

### 4.1 The Core Problem
In traditional scavenger hunts, the player who drives around for 48 straight hours automatically wins. This punishes players who have family commitments, work schedules, or only 4 hours to spare on Saturday.

### 4.2 Non-Punitive Multi-Category Scoring Framework
Canton Quests solves this by establishing **Multiple Leaderboard Categories & Category Championships**:

1. **Overall Grand Champion (Cumulative)**: Highest overall points across the entire weekend (for dedicated competitive teams).
2. **Saturday Sprint Champion (Single-Day Category)**: Highest points scored within a single 6-hour window on Saturday.
3. **Master Decoder (Puzzle Category)**: Highest score derived specifically from high-difficulty logic/cryptographic puzzles, requiring minimal distance traveled.
4. **Creative Visionary (Media Category)**: Voted best photo/video submissions for humor, effort, and storytelling.
5. **Local Business Explorer**: Most partner venue check-ins completed.
6. **Secret Hunter**: Most hidden easter eggs and unannounced flash quests discovered.

### 4.3 Point Allocation Formula
$$\text{Total Points} = \text{Base Quest XP} + \text{Difficulty Bonus} + \text{Speed/First-Finder Bonus} + \text{Creativity Bonus}$$

- **Base Quest XP**: Standard reward based on tier (Easy: 50, Medium: 150, Hard: 350, Epic: 750).
- **Difficulty Bonus**: Multiplier applied for low-hint completions.
- **First-Finder Bonus**: Diminishing point bonus for the first 10 players/teams to discover a secret location.
- **Efficiency Bonus**: Bonus awarded for completing quest chains with minimal back-tracking or hint usage.

---

## 5. Player Progression & Collectibles

- **Player XP & Levels**: Persistent across all weekend events (e.g., Level 1 "Canton Novice" $\rightarrow$ Level 10 "Urban Myth").
- **Badges & Achievements**: Permanent digital badges for milestone accomplishments (e.g., "Night Owl", "Downtown Historian", "Mural Master").
- **Collectibles**: Virtual or physical tokens (pins, coins, digital art) collected during quests.

---

## 6. Teams & Social Play

- **Team Size**: 1 to 5 players per team.
- **Shared Quest Log**: Team members share active quest state; any member scanning a valid QR updates the team log.
- **Proximity Guard**: Optional feature requiring at least 2 team members to be geo-located within 50m of each other during high-tier verifications to prevent remote point-farming.

---

## 7. Confirmed Mechanics vs. Open Design Questions

### CONFIRMED IDEAS
- Multi-category leaderboards preventing full-weekend player monopolies over all awards.
- Real-time leaderboard updates with a blackout period during the final 2 hours before the Sunday Finale to preserve surprise.
- Automated instant verification for QR, text, and GPS missions.
- Flash Quests dropping via push/SMS notifications during active event hours.

### OPEN DESIGN QUESTIONS
- **Hint Penalty System**: Should requesting a hint deduct raw points or add time penalties to speed awards?
- **Team Point Normalization**: Should a 5-person team earn slightly modified points per person compared to a solo player to balance team advantages?
- **Cooldown Limits**: Should players be capped on maximum active quests simultaneously (e.g. max 3 active quests at once)?
