# Canton Quests — Quest Design Principles & Guidelines

---

## 1. Core Philosophy

A great quest in Canton Quests is not a chore or an exam; it is a **gateway to discovery and excitement**. Every quest must convert a standard physical location in Canton into an memorable adventure moment.

---

## 2. The 17 Quest Categories

| Category | Description | Primary Verification |
| :--- | :--- | :--- |
| **1. Exploration** | Discover hidden architectural details, secret alleyways, or secluded park spots. | GPS Geo-fence / QR Code |
| **2. Puzzle** | Cryptic riddles, mathematical ciphers, visual pattern matching. | Code / Text Passphrase |
| **3. Observation** | Finding specific details on historical plaques, statues, or storefront signs. | Text Answer |
| **4. Social** | Friendly interactions (e.g. asking a barista for today's secret phrase). | Passphrase / Photo |
| **5. Creative** | Crafting funny photos, team poses, or short story videos. | Media Upload |
| **6. Photo / Video** | Recreating iconic movie poses or historical scenes at Canton landmarks. | Image / Video Upload |
| **7. Hidden-Object** | Locating tiny physical markers (e.g. painted micro-symbols or decals). | QR Code / Secret Code |
| **8. Business Partner** | Visiting local coffee shops, bookstores, or restaurants for quest clues. | QR Code / Receipt Code |
| **9. Physical Challenge** | Walkable stairs, park trails, or active physical tasks (always safe & accessible). | GPS / Sensor / QR |
| **10. Trivia / History** | Deep-dive Canton history (Football Hall of Fame heritage, McKinley Monument lore). | Text Input |
| **11. Secret Quest** | Unlisted quests unlocked only by deciphering hidden codes scattered in other quests. | Special Code Unlock |
| **12. Chain Quest** | Multi-stage sequential adventures where step 1 reveals step 2. | Progressive QR / Codes |
| **13. Flash Quest** | Limited-time pop-up missions (active for 30–90 minutes only during event). | Time-sensitive GPS/QR |
| **14. Cooperative Quest**| Requires 2 distinct teams to collaborate at the same location to solve a dual lock. | Multi-team QR Scan |
| **15. Competitive Quest**| Limited reward pools where the first 5 teams to finish claim exclusive bonuses. | Timestamp Rank |
| **16. Nighttime Quest** | Special illuminated check-ins active only after dusk (in well-lit, safe downtown areas). | QR / Photo |
| **17. Finale Quest** | High-stakes final puzzle unlocked during the final hours of a weekend event. | Admin / Live Reveal |

---

## 3. The 8-Point Quest Evaluation Rubric

Every quest proposal must be evaluated against these 8 mandatory criteria before being approved for an event:

```
                  ┌───────────────────────────────┐
                  │    8-POINT EVALUATION RUBRIC  │
                  └───────────────┬───────────────┘
                                  │
     ┌──────────────┬─────────────┼──────────────┬──────────────┐
     ▼              ▼             ▼              ▼              ▼
   [FUN]        [CLARITY]     [SAFETY]     [SHAREABILITY]  [DIFFICULTY]
     │              │             │              │              │
     └──────────────┴──────┬──────┴──────────────┴──────────────┘
                           ▼
              ┌───────────────────────────┐
              │  [CHEAT RESISTANCE]       │
              │  [LOCATION VALUE]         │
              │  [REPLAY VALUE]           │
              └───────────────────────────┘
```

1. **FUN**: Does this quest evoke curiosity, laughter, or a feeling of triumph upon completion?
2. **CLARITY**: Can a player understand the objective within 5 seconds without reading paragraphs of dense instructions?
3. **SAFETY**: Is the location free of traffic hazards, unsafe construction, private property issues, or night risks?
4. **SHAREABILITY**: Will completing this make the player want to post a photo or invite their friends?
5. **DIFFICULTY BALANCE**: Is the effort required proportional to the point reward earned?
6. **CHEAT RESISTANCE**: Can this be solved using Google Maps street view or ChatGPT from a couch? (If yes, redesign!).
7. **LOCATION VALUE**: Does this highlight an interesting, beautiful, or culturally rich spot in Canton?
8. **REPLAY VALUE / VARIATION**: Can this quest location host different mechanics in future events?

---

## 4. Bad Quest Patterns (Anti-Patterns to Avoid)

- ❌ **"The Couch Search"**: Quests solvable entirely online without leaving home (defeats real-world premise).
- ❌ **"The Endless Grind"**: Requiring players to walk 8 miles for 10 points (exhausting, low reward).
- ❌ **"The Hidden Needle in a Haystack"**: Hiding a tiny QR code under a park bench where players look suspicious searching around public furniture.
- ❌ **"The Bottleneck"**: A quest location that forces 50 people to stand in line at a single doorway or counter.
- ❌ **"The Trespasser Trap"**: Clues placed near residential property lines causing confusion about boundaries.
- ❌ **"The Paywall Trap"**: Requiring a player to make a mandatory purchase at a business to get a quest clue (must always have a free alternate method).

---

## 5. Quest Verification Matrix

| Verification Method | Reliability | Anti-Cheat Strategy |
| :--- | :--- | :--- |
| **QR Code Scan** | High | Dynamic rotating HMAC QR tokens or location proximity check. |
| **GPS Geo-Fence** | Medium | Combined with timestamping and minimum speed checks. |
| **Text Passphrase** | High | Answers based on physical site details not listed on Wikipedia. |
| **Photo / Video** | High | Required team member pose or unique event emblem visible. |
