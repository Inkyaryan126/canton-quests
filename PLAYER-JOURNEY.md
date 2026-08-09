# Canton Quests — Player Journey & Experience Design

---

## 1. Overview

The Canton Quests player journey is designed to be frictionless, deeply engaging, and emotionally satisfying from the first moment of discovery through post-event community retention.

---

## 2. The 14-Stage Lifecycle

```
[1. Discovery] ──> [2. Website Visit] ──> [3. Quick Join] ──> [4. Team / Solo Setup]
       │
[5. Enter Weekend] ──> [6. Receive Quests] ──> [7. Explore Canton] ──> [8. Submit Proof]
       │
[9. Score & XP] ──> [10. Flash Surprises] ──> [11. Return / Resume] ──> [12. Sunday Finale]
       │
[13. Rewards & Badges] ──> [14. Post-Event Retention]
```

### Stage 1: Discovering Canton Quests
- **Touchpoints**: Social media teaser videos, posters with QR codes in downtown Canton businesses, local word of mouth, or press coverage.
- **Hook**: "Something strange and exciting is happening in Canton this weekend. Will you play?"

### Stage 2: Visiting the Website / PWA
- **Experience**: Fast, mobile-optimized landing page with zero lag.
- **Visuals**: Dark, mystery-urban aesthetic with interactive city map preview, active weekend countdown timer, and clear single CTA ("Join the Quest").

### Stage 3: Joining (Sign-up / Authentication)
- **Mechanism**: Supabase Auth via SMS OTP, OAuth (Google/Apple), or Magic Link.
- **Speed**: Account created in under 30 seconds. No lengthy profile forms required up front.

### Stage 4: Selecting Solo or Team Play
- **Options**: Play as a Solo Agent or Create/Join a Team.
- **Team Code**: Team leader creates a team name and shares a 4-character invite code (`JOIN-QUEST-8X`) via SMS or QR.

### Stage 5: Entering an Active Weekend Event
- **Dashboard**: The player interface activates into "Event Mode". Shows local radar map, active quest board, team status, and real-time newsfeed.

### Stage 6: Receiving or Discovering Quests
- **Quest Feed**: Available quests filtered by proximity, difficulty, and type (Exploration, Puzzle, Creative, Partner).
- **Map View**: Pins indicate clue starting areas or physical challenge zones.

### Stage 7: Traveling Around Canton
- **Real-World Action**: Players walk, bike, or drive through Canton's Arts District, Parks, Centennial Plaza, and historic neighborhoods.
- **Observation**: Players examine architectural details, murals, historical plaques, and partner storefronts.

### Stage 8: Scanning / Interacting / Submitting Proof
- **Interaction**: Player arrives at target location.
- **Verification**: Taps "Verify Objective" to launch camera for QR scan, GPS check, or photo submission, or types in secret passphrase found on site.

### Stage 9: Scoring & Feedback
- **Instant Delights**: Haptic vibration, sound effect, animated badge unlock, and immediate point drop added to team/player total.

### Stage 10: Surprise Events & Flash Quests
- **Pop-Up Challenges**: A live alert triggers: *"FLASH QUEST: A mysterious briefcase has appeared at Centennial Plaza. First 5 teams to arrive earn 500 bonus points!"*

### Stage 11: Returning Later (Pause & Resume)
- **Flexibility**: Players can stop for lunch at a sponsor restaurant, take a 3-hour break, or pause for the evening. Game state is preserved seamlessly.

### Stage 12: Event Finale
- **Sunday Gathering**: Players gather at a local Canton venue or tune into the live broadcast. Real-time leaderboard blackout is lifted, live puzzle solutions are demonstrated, and winners are announced.

### Stage 13: Rewards & Results
- **Distribution**: Physical trophies, local business gift cards, exclusive physical pins, digital badges, and permanent hall-of-fame listings.

### Stage 14: Post-Event Retention
- **Community Loops**: Personal event recap card ("Your Canton Weekend Story"), shareable stats infographic, early access signup for the next weekend event, and persistent community lore forums.

---

## 3. Persona Journeys

### 3.1 Casual Player (Couples / Friends — 2 to 3 Hours)
- **Goal**: Enjoyable Saturday afternoon downtown stroll with food stops and light puzzles.
- **Flow**: Joins Saturday at 1:00 PM $\rightarrow$ Completes 4 exploration & local business quests $\rightarrow$ Grabs drinks at a partner brewery $\rightarrow$ Checks single-day leaderboard $\rightarrow$ Leaves with fun photos and digital badges.

### 3.2 Hardcore Competitive Team (4 Friends — Full Weekend)
- **Goal**: Maximize points, solve complex puzzle chains, win Overall Grand Champion.
- **Flow**: Receives pre-event teaser on Friday $\rightarrow$ Deploys strategy session $\rightarrow$ Covers maximum ground Friday night through Sunday afternoon $\rightarrow$ Solves epic cipher chain $\rightarrow$ Attends Sunday Finale to claim trophy.

### 3.3 One-Day Sprint Player (Saturday Only)
- **Goal**: High-intensity competitive play restricted to a single day.
- **Flow**: Enters Saturday morning $\rightarrow$ Targets high-value puzzle and flash quests $\rightarrow$ Competes for "Saturday Sprint Champion" category award $\rightarrow$ Achieves top-tier ranking without needing Friday/Sunday play.

### 3.4 Family Adventurers (Parents + Kids — 2 Hours)
- **Goal**: Safe, fun, educational outdoor exploration.
- **Flow**: Filters quest board by "Family Friendly" and "Walkable" tags $\rightarrow$ Solves historical plaque trivia and mural photo quests $\rightarrow$ Claims local ice cream partner discount coupon.
