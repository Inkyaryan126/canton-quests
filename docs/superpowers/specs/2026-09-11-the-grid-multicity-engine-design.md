# THE GRID — Multi-City Strategy Engine Design
**Status:** Approved architecture
**Date:** 2026-09-11
**Launch city:** Canton, Ohio — City #001
**Initial season:** Founding Season
**Launch surface:** Inside Canton Quests
**Product architecture:** Independent multi-city engine underneath

## 1. Product Vision

THE GRID is a persistent, shared, location-based strategy game built on real city geography.

It combines:
- Monopoly-style property acquisition, development, auctions, income, and trading
- Risk-style territorial pressure, influence, defense, and dice-driven contests
- Canton Quests-style location awareness, lore, live events, and real-world discovery

The permanent public framing is competition for **Influence, Control, Networks, Strongholds, and City Power**, not literal warfare.

The game is:
- playable from anywhere
- better when physically present in the city
- fair without pay-to-win
- seasonal so new players always have a path in
- designed from day one for multiple cities

**Canton is City #001, not hardcoded into the engine.**

---

## 2. Non-Negotiable Architecture Rule

Adding a new city must never require changing THE GRID Core.

If Cleveland, Columbus, Detroit, Chicago, or another city requires edits to contest logic, currencies, building rules, leaderboard rules, or alliance rules, the architecture has failed.

City-specific behavior belongs in city packages/configuration.

---

## 3. System Layers

### 3.1 GRID Core Engine

Universal rules only:
- Credits
- Influence
- Command Points
- territory ownership
- adjacency
- contests
- dice resolution
- defensive doctrines
- property development
- auctions
- direct trades
- alliances
- seasons
- dynamic events
- NPC factions
- City Power
- specialist leaderboards
- visitor/home-city rules
- anti-cheat
- immutable game-event ledger

No Canton-specific IDs, coordinates, landmark names, artwork, or one-off mechanics belong here.

### 3.2 City Package

Each city supplies data/config including:
- city metadata
- map bounds
- districts
- territory polygons
- territory adjacency graph
- selected properties
- landmarks
- NPC strongholds
- local map styling
- economy tuning
- event flavor/content
- season tuning
- sponsor inventory
- location-enhanced bonuses
- local restrictions
- residential/privacy transformations
- city-specific NPC faction names/lore

### 3.3 Global Player Identity

One player identity works across all cities.

Global/permanent:
- account
- callsign / identity
- Grid Passport
- lifetime reputation
- national reputation/rank
- trophies
- cosmetics
- titles
- city history
- season history
- lifetime records

Per-city and seasonal:
- Credits
- Influence
- territory
- properties
- structures
- local rank
- alliance membership
- city-specific assets
- seasonal City Power

### 3.4 Simulation & Operations Layer

Separate from player-facing game execution.

Used for:
- season simulations
- economy stress testing
- anti-snowball testing
- bot-player simulations
- contest balance testing
- collusion testing
- exploit testing
- city-package validation
- event impact simulation
- tuning recommendations

Agents may recommend and simulate changes, but they do not silently rewrite live game rules.

---

## 4. Map Model

### 4.1 Three Playable Geographic Layers

**Territories**
- primary units of expansion and control
- grouped from real city geography and parcel/block structure
- form the tactical Risk-style map
- adjacency matters

**Properties**
- selected real commercial/public/strategic properties within territories
- can be purchased, auctioned, traded, developed, or specialized
- not every parcel must become an individually named target

**Landmarks**
- unique strategic assets
- special mechanics
- typically not freely tradable
- may begin under NPC control
- can drive events and seasonal objectives

### 4.2 Residential Privacy / Brand Rule

Residential parcels may help define territory geometry but should not generally be presented as named conquest targets tied to a person's real home address.

Residential sections should usually appear as game territories/nodes, while recognizable public landmarks and selected commercial properties may retain real identities.

### 4.3 Geographic vs Game Logic Separation

PostGIS/geospatial layer knows:
- where things are
- polygons
- coordinates
- intersections
- adjacency candidates

GRID Core knows:
- how they behave
- ownership
- contests
- income
- development
- alliances
- leaderboards

Gameplay code operates on normalized IDs rather than raw coordinates whenever possible.

---

## 5. Map Presentation

Use a stylized **2.5D living city** rather than a plain Google-style map or full photorealistic 3D city.

Visual behavior:
- real street geometry underneath
- dark futuristic city styling
- glowing territory borders
- player control colors
- alliance boundary overlays
- virtual buildings rising from real property footprints
- contested zones animate
- NPC strongholds visually distinct
- live city events appear spatially
- landmark effects
- signal/dice contest effects
- skyline growth visible over time

Zoom behavior:

**City zoom**
- districts
- alliance borders
- high-level control
- major events
- skyline silhouettes

**District zoom**
- territories
- borders
- properties
- strongholds
- contested fronts

**Property zoom**
- parcel/building footprint
- virtual structures
- upgrades
- individual property details
- current defense/income/state

Virtual structures are stylized game assets, not attempts to represent legal ownership or literal changes to real buildings.

### 5.1 Canonical World Time

The normal playable world is the **present-day validated city package**. THE GRID does not begin from a sparse historical map and unlock the city year-by-year. Present streets, territories, public/commercial properties, landmarks, and roads are available according to normal gameplay rules from the start of a season.

Historical metadata is retained as a narrative and provenance layer. It may power historical missions, vanished-place clues, archival overlays, or isolated limited-time **Echo** experiences, but it does not gate the normal economy or remove modern assets from the canonical board.

The long-term visual/gameplay arc is:

**real present-day city → player control → investment and development → Skylines / factions / contests → player-created future city**

Any future mode that temporarily replaces the canonical present-day board with a historical ruleset requires an explicit product/architecture decision rather than silently deriving availability from historical dates.

---

## 6. Core Economy

Three core resources only.

### Credits
Economic currency.

Used for:
- acquiring properties
- auctions
- upgrades
- repairs
- direct trades
- contracts
- development
- certain infrastructure actions

Primarily generated by property/territory economy.

### Influence
Strategic control resource.

Used for:
- contests
- defense
- maintaining control
- reinforcing fronts
- strategic map actions

Influence must not simply be purchasable in unlimited amounts with Credits.

### Command Points
Pacing resource.

Used for major strategic actions.

Regenerates over time.

Prevents players with unlimited free time from brute-forcing the map all day.

### Economy Separation

Wealth and strategic power should correlate, but not collapse into the same thing.

A rich player can still have weak borders.
A powerful territorial player can still have limited cash.

---

## 7. Monetization Principle

**Competitive power is earned.**

Real money may buy:
- cosmetics
- building skins
- profile effects
- animated borders
- alliance cosmetics
- season cosmetic passes
- prestige visuals
- sponsored experiences

Real money may not buy:
- Influence
- Command Points
- better dice
- combat advantages
- direct territory power
- leaderboard placement

Business/city revenue opportunities may include:
- sponsored landmarks
- sponsored city events
- branded cosmetic collections
- city launch partnerships
- tourism/downtown partnerships
- future licensing
- city packages / operator relationships

---

## 8. Seasonal Structure

### 8.1 Reset Model

Each city uses seasons.

Seasonal reset:
- territory ownership
- local Credits
- local Influence
- most buildings/development
- district control
- seasonal alliance control
- local seasonal City Power

Permanent:
- reputation
- trophies
- cosmetics
- titles
- passport history
- season records
- lifetime records
- prestige unlocks that do not create unfair competitive power

### 8.2 Canton Launch

First Canton season:
**THE GRID — CANTON**
**FOUNDING SEASON**
**CITY #001**

Initial target duration: approximately 30 days, tunable by configuration.

---

## 9. Season Start

A season begins with a largely neutral city.

Acquisition types:
- low-tier territories may be open claims or cheap acquisitions
- valuable properties open through auctions
- major landmarks begin under NPC/faction control
- some locations remain dormant until activated by events

The season opening should feel like a strategic land rush, not a speed-click contest.

---

## 10. New Player Onboarding

Target first session: roughly 5–10 minutes.

Flow:
1. Select/confirm Home City
2. Receive starter Credits + Influence
3. Choose from a limited set of valid starter territories
4. Claim first territory
5. See first virtual structure rise
6. Complete first building upgrade
7. See first income event
8. Complete a safe tutorial contest against NPC territory
9. Unlock the full shared city

Core lesson:
**claim → build → earn → reinforce → contest → expand**

Advanced systems should unlock progressively instead of overwhelming new players immediately.

---

## 11. Return Loop

THE GRID should be satisfying in short sessions.

While offline:
- Credits accrue
- eligible Influence accrues
- Command Points regenerate
- auctions continue
- city events continue
- asynchronous contests may occur
- alliance activity continues

Resources have storage/cap mechanics so players benefit from returning without being forced to babysit the game.

Return summary example:
- time away
- Credits produced
- Influence generated
- Command Points restored
- territory challenged
- auctions ending
- Skyline bonuses activated
- events detected

The player then spends a few minutes making meaningful choices and leaves again.

---

## 12. Territory Adjacency & Expansion

Normal expansion requires adjacency or a valid network connection.

Players should not be able to attack arbitrary locations across the city.

Territory networks matter for:
- expansion
- reinforcement
- trade corridors
- defensive structure
- alliance borders
- Skyline bonuses
- district control

Special rare actions may bypass adjacency, but they should be explicit game mechanics.

---

## 13. Contest System

Contests provide the Risk-style tension.

### 13.1 Base Contest
- attacker commits Influence
- defender commits or uses reserved Influence
- attacker may roll up to 3 Signal Dice based on committed strength
- defender may roll up to 2 Signal Dice
- highest compares to highest
- second-highest compares to second-highest
- loser of each comparison loses Influence
- ties favor defender
- attacker chooses to continue or withdraw after rounds

Exact thresholds/dice availability are tunable config.

### 13.2 Tactical Layer

Players choose tactics that affect contest behavior.

Initial tactical concepts:
- Pressure
- Flank
- Fortify
- Feint

Influence determines baseline power.
Tactics may modify probabilities/bonuses.
Controlled luck keeps contests uncertain.

A weaker player can outplay a stronger player in close fights, but raw power still matters.

### 13.3 Offline Defense

Players set:
- defense doctrine
- reserve Influence
- auto-retreat / loss thresholds
- optional priority rules

This lets the city remain alive without forcing players to remain online constantly.

### 13.4 Live Contests

If attacker and defender are both online, the game may offer a more interactive live contest presentation.

---

## 14. Property Development

Owned properties may be developed vertically.

Buildings visibly grow on the real city map as players invest.

### Development Specializations

**Commerce**
- increases Credit generation
- improves market/trading value

**Influence**
- improves Influence generation / local projection

**Fortress**
- strengthens defense
- may support neighboring holdings

**Intel**
- reveals strategic information
- may improve awareness of nearby actions/events

**Prestige**
- high visual/status value
- contributes meaningfully to City Power and seasonal prestige systems

### Takeover Damage

Taking a developed property should not grant the attacker 100% pristine value.

A takeover may:
- damage development
- retain a configurable percentage of upgrades
- require repairs
- create strategic decisions about attacking vs building

### Skyline System

Connected developed properties form Skylines.

Skyline combinations may provide:
- economic bonuses
- defensive bonuses
- Influence bonuses
- intelligence bonuses
- prestige bonuses
- mixed-specialization bonuses

This creates neighborhood-level strategy.

---

## 15. City Power & Leaderboards

### Main Seasonal Score

**City Power** determines the season champion.

It combines multiple capped/curved components so one strategy cannot dominate everything.

Possible components:
- territory control
- district dominance
- developed property value
- landmark control
- economic strength
- Influence strength
- contest performance
- seasonal objectives
- prestige achievements

Weights and caps are configuration, not hardcoded constants.

### Specialist Leaderboards

Examples:
- City Power
- Net Worth
- Territory Control
- Strongest Skyline
- Contest Record
- Landmark Control
- Alliance Power

---

## 16. THE SURGE

Final approximately 72 hours of a season become a special finale phase.

Possible configurable effects:
- district control value increases
- landmark value increases
- hotspot territories activate
- special objectives activate
- NPC strongholds appear
- map presentation changes
- final rankings emphasized

Goal:
keep the season competitive and dramatic until the end.

---

## 17. Anti-Snowball Philosophy

**Success gives power. Power creates exposure.**

Avoid fake rubber-banding.

Large empires may face:
- increased Influence upkeep
- more exposed borders
- higher long-distance action costs
- stronger NPC pressure
- more valuable opposing objectives around them
- Dominance Heat

Smaller/newer players receive opportunity, not free wins:
- cheaper neutral expansion
- underdog contracts
- strategic openings
- high-value objectives near dominant empires

A player joining late should still be able to meaningfully affect the season.

---

## 18. Dominance Heat

If one player or alliance controls too much of a city:
- neutral factions strengthen
- rival objectives appear
- contested rewards may rise on borders
- anti-monopoly contracts may appear
- upkeep/exposure increases

The #1 player remains #1 because they earned it, but holding #1 becomes active gameplay.

---

## 19. Alliances

Alliances are map entities, not just chats.

Members retain ownership of:
- personal territory
- properties
- Credits
- personal progression

Alliance systems may include:
- connected Alliance Networks
- alliance boundary overlay
- limited pooled Influence/defense resource
- coordinated contests
- shared corridors
- alliance projects
- alliance identity/emblem
- public alliance page
- seasonal Alliance Leaderboard

Potential Alliance Projects:
- relay towers
- market hubs
- defense grids
- trade infrastructure

Large alliances must have coordination/upkeep costs so one mega-alliance cannot automatically dominate.

Leaving/joining alliances should include cooldowns and loss of shared bonuses.

---

## 20. Market & Trading

### Public Market
- fixed-price listings
- auctions

### Direct Deals
Atomic player-to-player exchanges may include:
- Credits
- eligible properties
- eligible assets

Not tradable:
- Influence
- Command Points

Major landmarks generally cannot be freely sold.

Controls:
- post-capture trade cooldown
- transaction logging
- server-authoritative atomic settlement
- anti-collusion analysis
- transaction tax / economic sink
- city economies remain isolated

Property speculation is a valid playstyle.

---

## 21. Dynamic City Events

Core engine supports generic event templates.

Examples:
- economic boom
- defense disruption
- property release
- auction wave
- Influence surge
- NPC takeover
- landmark crisis
- development discount
- route disruption
- location-enhanced cache

City packages supply:
- local names
- story
- affected locations
- art
- flavor
- tuning

Events give players a reason to return even without PvP conflict.

---

## 22. NPC Factions

NPC factions:
- control neutral strategic territory
- protect landmarks
- create PvE objectives
- react to Dominance Heat
- participate in events
- provide onboarding/tutorial opponents

They should behave like city systems, not filler bots.

Faction identity may differ by city while mechanics remain reusable.

---

## 23. Remote-First, Location-Enhanced

Everything essential should be playable remotely.

Physical presence may provide optional advantages such as:
- temporary bonuses
- scouting intel
- field caches
- special assets
- event participation
- reduced costs
- unique objectives
- Canton Quests crossover rewards

Location-based bonuses must never make remote play nonviable.

---

## 24. Home City / Visitor Economy

Global reputation travels.
Local wealth does not freely travel.

A player may have:
- Home City
- visiting status in another city
- local investment cap
- property limits
- residency/local standing
- city-specific rank

Potential visitor rules:
- deployment allowance
- investment cap
- limited property count
- progression toward local residency

Each city economy remains isolated to prevent wealthy players from dominating newly launched cities.

National reputation can reflect success across multiple cities.

---

## 25. Grid Passport

Permanent cross-city profile/history.

Potential records:
- cities entered
- home city
- city ranks
- championships
- peak rank
- lifetime territories controlled
- landmark achievements
- alliance championships
- seasonal trophies
- rare cosmetics
- national reputation

---

## 26. City Compiler

Future cities are created through a reusable pipeline.

Input may include approved:
- city boundaries
- street network
- parcel/building geometry
- neighborhood/district data
- parks/public spaces
- landmarks
- zoning/commercial data
- local configuration

Compiler produces a draft City Package:
- territories
- candidate properties
- landmarks
- adjacency graph
- district grouping
- starting values
- NPC strongholds
- economy suggestions
- local map labels
- validation output

Human approval is mandatory before launch.

---

## 27. City Validation

A City Validation Agent checks:
- overlapping polygons
- disconnected territories
- broken adjacency
- impossible routes
- unbalanced districts
- excessive concentration of value
- unreachable landmarks
- privacy/residential concerns
- malformed geometry
- missing required configuration
- unsafe or inappropriate real-world interactions

Raw city data goes in.
A validated City Package comes out.

---

## 28. AI Development Boardroom

### GRID Architect
Protects:
- module boundaries
- multi-city portability
- system contracts
- architecture consistency

### Game Director
Protects:
- fun
- pacing
- progression
- player experience

### Economy / Balance Agent
Tests:
- inflation
- resource sinks
- building ROI
- snowballing
- season economy
- dominance curves

### City Mapper
Handles:
- city-data ingestion
- territory suggestions
- property candidates
- landmark candidates
- map sanity

### Backend / Database Agent
Owns:
- authoritative game state
- transactions
- concurrency
- Supabase/Postgres integrity
- server-side rule enforcement

### Map / UI Agent
Owns:
- interactive map
- 2.5D visualization
- mobile usability
- animations
- state readability

### QA War Room
Simulates:
- many players
- long seasons
- edge cases
- concurrency
- abuse patterns

### Exploit Hunter
Attempts:
- multi-account farming
- collusion
- resource laundering
- duplicate rewards
- impossible actions
- race-condition exploits
- auction manipulation

### City Launch Agent
Eventually assists:
- City Package preparation
- validation
- launch checklist
- content completeness
- local tuning

Agents may propose or simulate live tuning, but production changes remain human-approved and auditable.

---

## 29. Immutable Game Event Ledger

Every important action must produce an append-only/auditable game-event record.

Examples:
- territory claim
- property purchase
- auction bid
- auction settlement
- direct trade
- upgrade
- contest started
- Influence committed
- tactic selected
- dice results
- contest result
- territory transfer
- defense action
- alliance action
- city event
- resource adjustment
- admin action

Benefits:
- anti-cheat
- dispute resolution
- debugging
- analytics
- season replay/history
- agent simulation comparisons
- auditability

Derived/current-state tables may exist for speed, but important actions remain reconstructable/auditable from the event history.

---

## 30. Canton Founding Season — V1 Vertical Slice

### Ship in V1
- real Canton 2.5D map
- territories
- selected properties
- landmarks
- Credits
- Influence
- Command Points
- claiming
- auctions
- branching building development
- Skyline bonuses
- Risk-style Signal Dice contests
- tactics
- asynchronous/offline defense
- City Power
- specialist leaderboards
- 30-day-style season structure
- 72-hour Surge
- NPC-controlled landmarks
- several dynamic city events
- basic alliances
- Grid Passport / permanent reputation
- remote-first gameplay
- optional location-enhanced bonuses
- immutable game event ledger
- simulation tools
- anti-cheat foundation

### Architect Now, Expose Later
- advanced direct trading
- deep alliance megaprojects
- complex diplomacy/treaties
- national competitive rankings
- mature visitor-economy UX
- sponsorship self-service dashboard
- City Compiler admin UI
- advanced faction AI
- large catalog of event types
- many-city public selector

The database and Core must still support multi-city concepts from the first migration.

---

## 31. Success Criteria for V1

Canton Founding Season succeeds if:

1. A new player understands the core loop within 10 minutes.
2. Players have meaningful reasons to return multiple times per day without required babysitting.
3. Territory control visibly changes the real Canton map.
4. Building investment visibly changes the skyline.
5. Contests are tense and understandable.
6. A smaller player can occasionally outplay a stronger player without making strength meaningless.
7. No single strategy mathematically dominates City Power.
8. Early leaders are powerful but not permanently untouchable.
9. Alliances matter but cannot trivially absorb the entire city.
10. Economy remains stable through a simulated and real season.
11. Important actions are server-authoritative and auditable.
12. Canton-specific data is isolated from GRID Core.
13. A second city can be represented as a new City Package without changing Core mechanics.
14. Competitive outcomes cannot be purchased with real money.
15. The game feels unmistakably like THE GRID, not a reskinned Monopoly/Risk clone.

---

## 32. Explicitly Out of Scope for the First Build

- literal military/weapon framing
- real-world ownership claims
- encouraging entry onto private property
- named conquest of private residences
- pay-to-win resource sales
- fully photorealistic 3D city recreation
- cross-city wealth transfer
- unlimited offline resource accumulation
- AI making unapproved live-rule changes
- hardcoding Canton into universal engine logic

---

## 33. Product Positioning

Player-facing:
**A living strategy game built on your real city. Build your network. Develop territory. Control districts. Contest rivals. Shape the skyline.**

Partner/city-facing:
**A location-based civic strategy platform using real geography to encourage exploration, local discovery, community participation, and engagement with city landmarks and participating businesses.**

Initial relationship:
**THE GRID — by Canton Quests**

Long-term, THE GRID may become its own broader multi-city product while retaining integration with Canton Quests.

---

## 34. Final Architecture Principle

**Build one engine. Launch one city. Prove one season. Add cities through data, not rewrites.**
