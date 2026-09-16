# Visit Canton Cultural Tourism Grant — Workspace

**Purpose**: a working draft for a Visit Canton / Stark County cultural
tourism grant application built around Canton Quests. This is a
**workspace**, not a submission-ready application — every section that
needs a number, a partner confirmation, or a legal fact is marked
**TODO** rather than filled with a guess.

**Fact-check status**: sourced against this repository on 2026-09-16.
Companion doc: `docs/VISIT-CANTON-TOURISM-PITCH.md` (public-facing 30-second
pitch built from the same evidence base).

---

## 1. Project Concept

Canton Quests is a mobile-first, real-world game layered over downtown
Canton, Ohio. Players use their phones — no app install — to travel to real
landmarks, solve location-based puzzles and ciphers, and progress through a
season-long narrative ("Volume") that ends in a public finale event.
`PROJECT-BRAIN.md:9,16,102`

**Volume 1 — "The Founder's Cipher"** is the completed first season:
- Public launch September 11, 2026; event window through September 14, 2026.
  `LAUNCH-READINESS.md:3-5`
- 15 quests across 9 real downtown Canton sites: Centennial Plaza, McKinley
  National Memorial, a 4th Street mural, Aura Craft Coffee, Downtown Canton
  Arcade Vault, Canton Palace Theatre, the Pro Football Hall of Fame city
  marker, the Onesto entrance, and the Frankenstein Monument at West Lawn
  Cemetery. `LAUNCH-READINESS.md:25`, `DECISIONS.md:520`
- Individual (not team-based) citywide leaderboard, three difficulty/style
  paths (Family, Challenge, Secret), server-verified proof of visit (GPS
  radius, QR scan, passphrase, photo/video), a public spectator mode, and a
  transparent SHA-256-logged prize drawing. `LAUNCH-READINESS.md:11-22`

**Format**: designed as a recurring seasonal product, not a one-off — new
"Volumes" every few months, each with a new downtown-Canton storyline.
Volume 2 ("The Industrial Catalyst" — manufacturing legacy) and Volume 3
("The Hall of Shadows" — sports heritage) are named future seasons, **not
yet built**. `WORLD-BUILDING.md:45-46`

---

## 2. Visitor / Cultural Tourism Impact

### What's real and demonstrable today
- The game physically routes players to 9 historic/cultural downtown Canton
  sites in a single event, including federally/civically significant
  locations (McKinley National Memorial) and local cultural landmarks
  (Canton Palace Theatre, West Lawn Cemetery's Frankenstein Monument).
  `LAUNCH-READINESS.md:25`, `DECISIONS.md:520`
- Local independently-owned businesses (Aura Craft Coffee, Downtown Canton
  Arcade Vault) are written directly into the core quest content, not
  bolted on as ads. `LAUNCH-READINESS.md:41-42`
- The product's own stated tourism value proposition: "increased downtown
  foot traffic, activation of civic assets and parks, positive local press,
  and weekend economic activity for Canton." `BUSINESS-MODEL.md:26,38-39`
  — this is the project's *design intent*, not a measured claim.

### TODO before submission — real impact data
- [ ] **TODO**: Actual player/participant count for the Volume 1 weekend
      (Sept 11–14, 2026). Not in this repo — pull from Supabase
      (`players` table / admin dashboard) or the game's own
      `computeEventReadinessReport` metrics (`lib/event-readiness.ts`),
      which do track `registeredPlayers` live in production.
- [ ] **TODO**: Completion rate / quests-per-player, geographic origin of
      players (local vs. visitor), age/group breakdown if collected.
- [ ] **TODO**: Direct visitor spend or foot-traffic increase reported by
      Aura Craft Coffee / Downtown Canton Arcade Vault — ask the businesses
      directly, this is not tracked in the codebase.
- [ ] **TODO**: Press coverage, social media reach, or earned-media log for
      the Volume 1 launch weekend.
- [ ] **TODO**: Photo/video documentation of players at the physical sites
      (useful as grant-application visual evidence) — check
      `public/canton-quests/` and any street-team/marketing capture from
      launch weekend for usable, consent-cleared images.

**Do not submit a grant application with invented visitor numbers.** If the
above data isn't available in time, state Volume 1 as a *pilot/proof-of-
concept* and request the grant to fund Volume 2's *measurement*
infrastructure explicitly (see Budget Framework below).

---

## 3. Measurable Outcomes (proposed — needs sign-off before submission)

These are **draft candidate metrics**, not commitments. Mark each ✅ once a
real baseline/target is agreed with Visit Canton and the founder — none are
filled in yet because no historical baseline exists in this repo.

| Metric | Volume 1 baseline (TODO) | Volume 2 target (TODO) | Data source |
|---|---|---|---|
| Unique players registered | TODO | TODO | Supabase `players` table |
| Quests completed (total) | TODO | TODO | `lib/event-readiness.ts` readiness metrics |
| Partner businesses featured | 2 (Aura Craft Coffee, Arcade Vault) `LAUNCH-READINESS.md:41-42` | TODO | This repo / partner agreements |
| Downtown sites activated | 9 `LAUNCH-READINESS.md:25` | TODO | This repo |
| Out-of-county / visitor participants | TODO (not tracked) | TODO | Would require new registration field — not currently collected |
| Local press mentions | TODO | TODO | Manual tracking, not in repo |
| Partner-reported foot traffic increase | TODO | TODO | Direct partner survey, not in repo |

**Open question for the grant team**: does the current player registration
flow (`app/register/page.tsx`, Supabase Auth) collect *home zip code / city*
at all? If not, "visitor vs. local" cannot be measured for Volume 1 and
would need to be added before Volume 2 to give the grant funder real
tourism-draw evidence. **TODO: confirm with engineering.**

---

## 4. Budget Framework (skeleton — no real figures)

This section is a structure to fill in with the founder, not a proposed
dollar ask. Every line is **TODO** until real costs are supplied.

| Category | Volume 1 actual cost (TODO) | Volume 2 requested (TODO) | Notes |
|---|---|---|---|
| Physical QR signage / printing | TODO | TODO | `scripts/qr-campaign-cli.ts` generates flyers; production print run cost not in repo |
| Prize pool (trophies, gift cards) | TODO | TODO | Volume 1 prizes: "$100 Canton Local Pass," "Year of Aura Coffee VIP Pass" `LAUNCH-READINESS.md:52` — dollar total not recorded |
| Marketing / street-team distribution | TODO | TODO | Street-team flyer system exists (`npm run qr:campaign`); spend not in repo |
| Venue / finale event costs (PA, staffing) | TODO | TODO | `LAUNCH-READINESS.md:53-54` lists these as pending checklist items, no cost |
| Development / engineering time | Not grant-relevant (sunk, pre-built) | N/A | Full Volume 1 software stack already built and shipped |
| Visitor-impact measurement tooling (new) | N/A | TODO | If home-city tracking is added for Volume 2, this is a legitimate new line item to request grant funding for |

**Recommended framing for the ask**: given Volume 1's software is a sunk
cost and already proven, the strongest, most honest grant ask is likely
**Volume 2 physical production, marketing, and (new) visitor-impact
measurement** — not a request to rebuild something that already works.

---

## 5. Evidence Checklist (what to gather before submitting)

- [ ] Real Volume 1 player count and completion stats (Supabase export)
- [ ] Partner business confirmation letters / testimonials (Aura Craft
      Coffee, Downtown Canton Arcade Vault) — confirm their Volume 1
      participation actually happened; `LAUNCH-READINESS.md` shows their
      site visits/briefings as pending as of the last recorded update
- [ ] Press/media log from launch weekend
- [ ] Photo/video evidence of players at physical sites (consent-cleared)
- [ ] A named legal entity for Canton Quests (grant applications typically
      require one) — **not found anywhere in this repo**; `README.md:87`
      only states "Copyright © Canton Quests," no LLC/Inc. name
- [ ] A real contact email / phone number for the applicant — **not found
      anywhere in this repo**
- [ ] Confirmation of whether West Lawn Cemetery formally approved the
      Frankenstein Monument quest — `LAUNCH-READINESS.md:43` shows this was
      an open item ("If cemetery rules disallow game visits, hide or
      replace this quest before launch") and should not be cited as a
      confirmed cultural-site partnership until resolved
- [ ] Sign-off from the founder on which future Volume (2 or 3) this grant
      is meant to fund, and a real target date — no 2027 or other future
      date exists anywhere in this repo today

---

## 6. Open Questions / TODOs for the founder

1. What is the legal entity name for Canton Quests (needed for any grant
   application's applicant-of-record field)?
2. Is there a real contact email/phone to use on official correspondence?
3. Do we have Visit Canton's actual grant program name, deadline, and
   application format? (Not specified in the task or repo — needed before
   this workspace can become a real submission.)
4. Can we get real Volume 1 attendance/engagement numbers from Supabase
   before drafting the "Measurable Outcomes" section for real?
5. Did the Aura Craft Coffee and Downtown Canton Arcade Vault partnerships
   actually go live for Volume 1, or were they pulled if the pending
   checklist items in `LAUNCH-READINESS.md` were never resolved?
6. Is there an official multi-year (e.g. 2027) roadmap commitment from
   Dustin/the founder that can be cited, or should this grant only speak to
   Volume 2 without a hard date?
