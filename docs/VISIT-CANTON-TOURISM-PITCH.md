# Canton Quests — Visit Canton Tourism Pitch (Phone-Friendly)

**Status**: Fact-checked against the codebase on 2026-09-16. Every claim below is
sourced (file:line). Anything not backed by a real, recorded source is marked
**UNKNOWN / TODO** — do not fill those in with guessed numbers before sending
this externally.

This doc is meant to be read on a phone in one sitting: a business owner, a
Visit Canton staffer, or a city contact should be able to scroll it end to end
in under two minutes.

---

## 1. What Canton Quests is (30 seconds)

> **Canton Quests turns downtown Canton into a real-world adventure game.**
> Players walk to real landmarks, solve on-site puzzles, scan QR codes, and
> unlock a season-long mystery — all on their phone, no app download required.
> It's part scavenger hunt, part escape room, spread across the city instead
> of one building. `PROJECT-BRAIN.md:9,16,102`

- Built as a mobile-first Progressive Web App (Next.js/TypeScript/Supabase) —
  works in any phone browser. `PROJECT-BRAIN.md:16`
- No teams required — every player has their own profile and spot on a
  citywide leaderboard. `LAUNCH-READINESS.md:14`
- Three starting paths (Family / Challenge / Secret) so the same event works
  for a family afternoon, a competitive friend group, or a solo puzzle-hunter.
  `LAUNCH-READINESS.md:14`

---

## 2. Volume 1 — "The Founder's Cipher" (what's actually built and live)

- **Public launch**: September 11, 2026. Event window ran September 11
  (6:00 PM UTC) through September 14, 2026 (10:00 PM UTC). `LAUNCH-READINESS.md:3-5`
- **15 canonical quests** across **9 real downtown Canton locations**:
  Centennial Plaza, McKinley National Memorial, the 4th Street mural, Aura
  Craft Coffee, Downtown Canton Arcade Vault, Canton Palace Theatre, the Pro
  Football Hall of Fame city marker, the Onesto entrance, and the
  Frankenstein Monument at West Lawn Cemetery. `LAUNCH-READINESS.md:25`; `DECISIONS.md:520`
- Software/engineering side was fully built and tested before launch: 386
  automated tests passing, 0 TypeScript errors, full server-side proof
  verification (GPS, QR, passphrase, photo, video), a public spectator mode
  (`/watch`), and a transparent prize-drawing system with a published SHA-256
  ledger. `LAUNCH-READINESS.md:11-22`

### Player / usage metrics
**UNKNOWN / TODO.** There is no recorded player-count, registration, or
completion-rate data anywhere in this repository — only pre-launch *design
targets* (not results): a beta target of 50–100 local participants and a
Volume 1 target of 300+ public participants across the weekend.
`ROADMAP.md:48,58` Do not quote these as attendance figures — they were
goals set before launch, not a measured outcome. Pull real numbers from
Supabase/analytics before using this pitch with a live audience count.

### Business partners already written into the game
- **Aura Craft Coffee** — 414 4th St NW, Canton, OH — in-game counter
  passphrase quest step. `LAUNCH-READINESS.md:41`
- **Downtown Canton Arcade Vault** — 218 Market Ave N, Canton, OH — in-game
  challenge quest step. `LAUNCH-READINESS.md:42`

  *Note:* as of the last recorded update to `LAUNCH-READINESS.md`, the
  physical partner visit / staff-briefing checklist items for both
  businesses were still marked **pending**. Confirm current on-the-ground
  status with the operations lead before naming these businesses to a city
  or grant contact as a completed case study.

---

## 3. How a local business can participate

Straight from the project's own business model doc (`BUSINESS-MODEL.md`) —
these are the real, already-designed participation tiers, not speculative
ideas:

| Tier | What it is | Price (as designed) |
|---|---|---|
| **Quest Location Partner** | Your storefront becomes a quest stop; players are sent to you as a scan/check-in objective. | $150–$300 / event `BUSINESS-MODEL.md:50` |
| **Featured Quest Sponsor** | A custom branded quest built around your business (e.g. a secret passphrase at the counter). | $500+ / event `BUSINESS-MODEL.md:51` |
| **Weekend Title Sponsor** | Full event co-branding ("Canton Quests — Presented by ___"). | Custom `BUSINESS-MODEL.md:54` |
| **Prize Pool Sponsor** | Provide a cash/product prize, get trophy-presentation rights at the finale. | Custom `BUSINESS-MODEL.md:55` |

Guardrails that make this safe to pitch to a business owner:
- No pay-to-win, ever — sponsorship never affects gameplay or scoring.
  `BUSINESS-MODEL.md:5-7`
- No intrusive ads or pop-ups during play. `BUSINESS-MODEL.md:68`
- A free path to complete every quest always exists — players are never
  forced to buy something to progress. `BUSINESS-MODEL.md:70`

**Why it's worth it for them**: guaranteed foot traffic during a live event,
brand exposure to an engaged local audience, and customer acquisition during
off-peak hours (e.g. Saturday afternoon). `BUSINESS-MODEL.md:33`

---

## 4. City / tourism value (the pitch to Visit Canton specifically)

The project's own value-proposition framework names "Tourism Value" as one of
four pillars, described as: **increased downtown foot traffic, activation of
civic assets and parks, positive local press, and weekend economic activity
for Canton.** `BUSINESS-MODEL.md:26,38-39`

This is a design intention, not a measured economic-impact claim — there is
no dollar figure or visitor-spend number recorded anywhere in the repo.
**UNKNOWN / TODO**: get real foot-traffic or spend data from partner
businesses / the city before making a quantified economic-impact claim.

---

## 5. What's next — multi-volume, multi-city vision

Canton Quests is designed as a **seasonal format**, not a one-off:

- **Volume 2 — "The Industrial Catalyst"**: Canton's manufacturing legacy,
  steam tunnels, vintage machinery lore. `WORLD-BUILDING.md:45`
- **Volume 3 — "The Hall of Shadows"**: sports heritage, stadium legends,
  secret champions. `WORLD-BUILDING.md:46`
- **Longer-term roadmap** (Phase 7, currently unbuilt): expand the same
  platform to additional mid-sized cities — Akron Quests, Cleveland Quests
  are named as examples. `ROADMAP.md:85-91`

**"2027 vision" — UNKNOWN / TODO.** No document in this repository names
2027 or gives a dated multi-year timeline. If a pitch needs a specific
2027 commitment (e.g. "Volume 2 launches summer 2027"), that date has to
come from the founder directly — do not invent one here.

---

## 6. 30-second spoken pitch (contact-ready)

> "Canton Quests is a real-world adventure game we built for downtown
> Canton — players use their phone to solve puzzles at real landmarks like
> the McKinley Memorial and the Palace Theatre, scan QR codes, and race
> toward a season finale with real prizes. We launched our first season,
> The Founder's Cipher, across nine downtown locations in September 2026,
> with local businesses like Aura Craft Coffee built directly into the
> story. It's designed to keep bringing people downtown every few months
> with a new 'Volume' — and we'd love to talk about how [Visit Canton /
> your business] could be part of the next one."

**Contact**: `[INSERT ORGANIZATION CONTACT EMAIL — none found in repo]`
No legal entity name, phone number, or official contact email is recorded
in this codebase (`README.md`, `.env.example`, and the site footer were all
checked). Insert real contact details before distributing this pitch.

---

## 7. Evidence index (for whoever fact-checks this before it goes out)

| Claim | Source |
|---|---|
| What Canton Quests is | `PROJECT-BRAIN.md:9,16,102` |
| Launch date / window | `LAUNCH-READINESS.md:3-5` |
| 15 quests / 9 locations | `LAUNCH-READINESS.md:25`, `DECISIONS.md:520` |
| Software readiness (tests/build) | `LAUNCH-READINESS.md:11-22` |
| Partner businesses + pending status | `LAUNCH-READINESS.md:41-43,79` |
| Sponsorship tiers & pricing | `BUSINESS-MODEL.md:43-55` |
| Anti-pay-to-win guardrails | `BUSINESS-MODEL.md:5-7,68,70` |
| Tourism value framing | `BUSINESS-MODEL.md:26,38-39` |
| Volume 2 / Volume 3 | `WORLD-BUILDING.md:45-46` |
| Multi-city Phase 7 | `ROADMAP.md:85-91` |
| No 2027 date exists | repo-wide search, no match |
| No real usage metrics exist | repo-wide search; only design targets at `ROADMAP.md:48,58` |
