# Canton Quests — Project Brain (Canonical Source of Truth)

---

## 🛑 NON-NEGOTIABLE CORE DIRECTIVE

> **Canton Quests should NEVER slowly mutate into a generic scavenger hunt SaaS product. The city/game-world feeling is central.**

If a feature, architectural choice, copy snippet, or UI pattern makes Canton Quests feel like an enterprise B2B form builder, a sterile check-in app, or a generic team-building SaaS tool, **it is invalid**. Canton Quests is a living, high-energy, mysterious, real-world game layered directly onto the physical geography and community fabric of Canton, Ohio.

---

## 1. Vision & Core Philosophy

### 1.1 Vision Statement
Canton Quests turns an entire physical city into an interactive, unfolding game world. Through weekend-long events, persistent urban mysteries, local business challenges, pop-up events, and real-world exploration, Canton Quests bridges physical space and digital gameplay to deliver unforgettable adventures for players of all backgrounds.

### 1.2 The Core Experience
When Canton Quests activates for a weekend:
- **The city comes alive**: Historical monuments, local coffee shops, alleyways, parks, and downtown arcades become active game nodes.
- **Physical meets digital**: Mobile web interface acts as the player's field scanner, decoder, map, and logbook, but the action happens out in the real world.
- **Inclusive participation**: Whether a player has 90 minutes on Saturday morning or 14 hours across Friday-Sunday, they experience high-stakes fun, meaningful progress, and real chances to earn recognition and prizes.
- **Community dynamic**: Competitors cross paths downtown, solve puzzles side-by-side, share hints over local meals, and gather for Sunday evening event finales.

---

## 2. What Makes Canton Quests Different?

| Generic Scavenger Hunt App | Canton Quests |
| :--- | :--- |
| Static list of GPS check-ins & basic trivia. | Multi-layered narrative events with flash quests, live NPCs, and surprise drops. |
| Pay-to-win mechanics or paywalled hints. | Pure skill, creativity, observation, speed, and individual tactical strategy. |
| Favors whoever can drive the fastest for 48 hours. | Multi-tier scoring & non-punitive mechanics allowing 1-day players to win categories. |
| Isolated user tapping on a phone screen. | High-energy, highly shareable real-world adventure bringing foot traffic to local businesses. |
| White-label corporate utility. | Strong local identity, mysterious urban mythology, and distinct visual/tonal vibe. |

---

## 3. Target Audience & Player Personas

1. **The Casual Local Explorers (Couples & Friends)**
   - *Goal*: Fun weekend afternoon activity, discovering new spots in Canton, enjoying local food/drinks.
   - *Time*: 2–4 hours total.
   - *Needs*: Low barrier to entry, instant delight, clear safety guidance, zero frustration.

2. **The Hardcore Competitive Players**
   - *Goal*: Strategic dominance, maximum XP, secret quest unlocking, topping the individual leaderboard.
   - *Time*: Full weekend (10+ hours).
   - *Needs*: High depth, complex multi-stage puzzle chains, high-tier achievements, tactical trade-offs.

3. **The Family Adventurers**
   - *Goal*: Safe, engaging outdoor family activity for parents and kids.
   - *Time*: 2–3 hours during daytime hours.
   - *Needs*: Family-friendly quest filters, walking-friendly zones, safe environments, physical active challenges.

4. **The One-Day Sprint Players**
   - *Goal*: Heavy participation on Saturday only due to work/life constraints.
   - *Time*: 4–6 hours on a single day.
   - *Needs*: Category awards (e.g. "Saturday Sprint Champion", "Master Decoder") so they are not mathematically excluded from victory.

---

## 4. Key Terminology

- **Quest**: A self-contained challenge consisting of 1 to N steps (e.g., "The Secrets of 4th Street").
- **Mission / Step**: An individual objective within a quest (e.g. scan a hidden QR code, take a creative video, answer a historical puzzle).
- **Weekend Event**: A scheduled 2 to 3-day active game window in Canton (e.g. *Canton Quests: Volume 1 — The Founder's Cipher*).
- **Node / Location**: A physical point of interest in Canton tied to a quest or clue.
- **Flash Quest**: A timed, pop-up mission announced live during an active event window.
- **Proof Submission**: The verification mechanism submitted by a player (GPS scan, photo/video, secret passphrase, numerical code).
- **Keepsake / Collectible**: Digital badges or physical tokens awarded for completing specific achievements or secret storylines.
- **Finale**: The closing gathering at the end of a weekend event where final awards, live puzzle solutions, and grand prizes are revealed.

---

## 5. Product Principles

1. **Real-World First**: The phone is a tool, not the destination. Players look UP at the city, not DOWN at a screen continuously.
2. **Fairness Over Grind**: Time investment opens options, but strategy, speed, intelligence, and creativity dictate outcomes.
3. **Safety Is Architecture**: Safe paths, daytime-preferred zones, clear physical boundaries, and strict conduct rules are embedded into every quest.
4. **Local Empowerment**: Canton businesses, landmarks, and cultural assets are celebrated heroes of the game world.
5. **Progressive Complexity**: Simple enough for anyone to join in 60 seconds; deep enough to intrigue veteran puzzle solvers.
6. **Pure Individual Competition**: Canton Quests is played and scored by individual players without team join codes or squad administration barriers.

---

## 6. Long-Term Expansion Vision

While **Canton, Ohio** is our initial launch pad and testing ground, the underlying game engine and schema architecture are built from day one to support multi-city expansion (*Akron Quests*, *Cleveland Quests*, *Savannah Quests*, etc.) without refactoring core game logic.

---

## 7. Known Decisions vs. Open Questions

### Confirmed Decisions
- **Official Public Launch Date**: September 11, 2026 (Launch Weekend: September 11–14, 2026).
- **Launch Location**: Canton, Ohio.
- **Game Identity**: City-scale game, not a generic SaaS tool.
- **Player Model**: Pure individual player competition without squad / team membership mechanics.
- **Visual Identity**: Official canonical logo locked at `public/brand/canton-quests-master-logo.png`.
- **Scoring Philosophy**: Non-punitive scoring allowing partial-weekend players to compete for distinct category championships.
- **Tech Foundation**: Web-first PWA approach (Next.js, TypeScript, Supabase) for frictionless zero-download onboarding via QR code scanning.
- **Safety Guarantee**: Quests are pre-screened for physical safety, traffic control, and property access before going live.

### Open Questions (To Be Tested in Beta)
- What is the optimal ratio of instant automated check-ins (QR/GPS) versus manual AI/admin-reviewed submissions (photo/video)?
- How far in advance should quest starting locations be revealed before a weekend event launches?

---

## 8. Anti-Goals

- ❌ **Do NOT** build a generic B2B form/survey generator.
- ❌ **Do NOT** allow pay-to-win microtransactions (buying hints or points with real money).
- ❌ **Do NOT** create quests that require dangerous physical feats, highway crossings, or trespassing onto private residential property.
- ❌ **Do NOT** force users to install heavy 200MB native app store bundles prior to playing their first mission.
- ❌ **Do NOT** design scoring systems where missing Friday night means zero chance of winning anything on Sunday.
- ❌ **Do NOT** generate or introduce alternate CQ logos without an explicit branding decision.

---

## 9. Official Brand & Visual Identity

> **Canonical Brand Rule**:
> The canonical Canton Quests logo is:
> `public/brand/canton-quests-master-logo.png`
>
> All future Canton Quests visual work must use this artwork or deterministic derivatives of this artwork (e.g. `public/brand/canton-quests-mark.png`, `public/brand/canton-quests-mark-512.png`, `public/brand/canton-quests-mark-192.png`, `public/brand/canton-quests-apple-touch-icon.png`, `public/brand/favicon.ico`).
>
> **Do not generate or introduce alternate CQ logos without an explicit branding decision.**
