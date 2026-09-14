# THE GRID — Season Economy + Ownership + Property Development Implementation Plan

**Date:** 2026-09-14  
**Prerequisite:** City Compiler + Canton Geography acceptance (`2026-09-12-the-grid-city-compiler-canton-geography-acceptance.md`)  
**Source spec:** `docs/superpowers/specs/2026-09-11-the-grid-multicity-engine-design.md`  
**Status:** APPROVED FOR IMPLEMENTATION

## 1. Goal

Turn the accepted Canton City #001 package into the first server-authoritative seasonal strategy loop:

**join → receive starter resources → claim neutral territory → earn → acquire property → develop → form connected Skylines → expand**

This phase implements roadmap item 2 only:

- join season,
- Credits / Influence / Command Point regeneration,
- neutral claims,
- territory-control projection,
- property acquisition,
- Commerce / Influence / Fortress / Intel / Prestige development,
- Skyline topology/bonuses,
- deterministic economy simulation.

Contests, Signal Dice, offline defense, auctions, alliances, Surge, NPC factions, the final 2.5D renderer, and production activation remain later phases.

## 2. Non-negotiable architecture rules

1. `lib/grid/core/**` and reusable economy/server modules contain **zero Canton-specific names or imports**.
2. Canton tuning belongs under `lib/grid/cities/canton/**` or season configuration.
3. Important mutations are server-authoritative and auditable through `grid_game_events`.
4. A mutation and its audit event must be atomic at the persistence boundary; no successful ownership/resource mutation may exist without its matching event.
5. Browser roles never receive direct mutation rights to Grid economy/ownership tables or mutation RPCs.
6. Every command is idempotent. Retrying the same idempotency key returns/reconciles the prior result rather than double-spending or double-claiming.
7. Resource/development math uses deterministic integer arithmetic; no floating-point currency state.
8. Gameplay constants are configuration, not literals hidden in services.
9. No production Supabase migration/import occurs during this implementation phase until a separate human-approved production gate.
10. Canton Quests XP/drawing state remains separate from Grid Credits/Influence/Command Points.

## 3. Deliberately NOT hardcoded

The design spec names systems but does not approve exact values for them. Therefore this plan explicitly rejects guessed constants for:

- offline accumulation cap,
- Credits/Influence yield rates,
- neutral claim Credit/Command Point costs,
- starter-territory set,
- property acquisition prices,
- number of development tiers,
- per-tier upgrade costs,
- per-tier branch bonuses,
- takeover damage/retention,
- repair costs,
- Skyline minimum size,
- Skyline synergy multipliers,
- anti-snowball/Gini thresholds.

Tests may use small fixture values to prove math. Canton Founding Season values are introduced only in the tuning task after deterministic simulation and are documented as tunable initial balance, not universal rules.

## 4. Configuration contract

Add a reusable optional `economy` configuration to the season template. Existing/legacy city packages remain valid without it; economy commands must fail closed with `ECONOMY_NOT_CONFIGURED` until the season explicitly supplies configuration.

The typed configuration must support, without embedding Canton:

- offline accrual cap in minutes,
- neutral claim policy and costs,
- starter territory slug allow-list,
- territory/property income rate configuration,
- property acquisition policy,
- development branch level tables,
- Skyline thresholds/bonus definitions.

Use basis points / integer ratios where a multiplier is required. Prefer explicit per-level tables over hidden exponential formulas.

## 5. Resource settlement rules

### Command Points

Lazy settlement at read/command time:

`wholeIntervals = floor((now - updatedAt) / regenInterval)`

`newCP = min(maxCP, currentCP + wholeIntervals)`

When settlement reaches the cap, overflow time is discarded so a player cannot bank invisible regeneration while already full and instantly refill after spending.

### Credits / Influence

Credits and Influence accrue from the player's current season holdings and development state. Settlement is lazy, not cron-driven.

Every ownership/development mutation must first settle the player's economy to the mutation timestamp, then alter holdings. This prevents a new property from receiving income for time before it was acquired.

Accrual is capped by the configured offline window. No configured cap means economy commands remain disabled rather than silently using a magic default.

## 6. Season ownership state

Add additive local migration(s), never edit prior Grid migrations.

### `grid_season_territory_state`

Current season-specific territory control:

- `season_id`
- `city_id`
- `territory_id`
- `owner_player_id` nullable (`NULL` = neutral)
- `claimed_at` nullable
- timestamps
- unique `(season_id, territory_id)`

Enforce season/city and territory/city consistency through composite FKs, not application assumptions.

### `grid_season_property_state`

Current season-specific property state:

- `season_id`
- `city_id`
- `property_id`
- `owner_player_id` nullable
- `acquired_at` nullable
- `development_branch` nullable (`commerce|influence|fortress|intel|prestige`)
- `development_level >= 0`
- `condition_bps` bounded `0..10000`
- timestamps
- unique `(season_id, property_id)`

No fixed maximum development level is placed in the DB; the active season configuration determines valid levels.

### Player economy settlement timestamp

Add a season-economy settlement timestamp to `grid_player_season_state` for Credits/Influence. Command Points keep their existing dedicated timestamp.

All new tables enable RLS and revoke browser `INSERT/UPDATE/DELETE`. Any mutation RPC is revoked from `anon`/`authenticated` and callable only through the server-authoritative path.

## 7. Transaction boundary

Supabase client calls cannot safely implement a multi-row claim/upgrade as independent requests. State changes that must atomically update wallet + ownership + immutable event use tightly scoped PostgreSQL RPC transactions invoked by the server adapter.

RPC rules:

- `SECURITY INVOKER` unless a reviewed reason requires otherwise,
- explicit `search_path`,
- execute revoked from `public`, `anon`, and `authenticated`,
- service-role/server use only,
- row-level locks on affected player/territory/property state,
- idempotency lookup before mutation,
- immutable event insert inside the same transaction,
- re-check every invariant inside the transaction even if TypeScript already checked it.

## 8. Neutral claim invariants

A neutral territory claim succeeds only when all are true:

1. season is active,
2. player has joined the season,
3. economy config exists,
4. territory belongs to the season's city,
5. territory is currently neutral,
6. player can pay configured Credits and Command Points without going negative,
7. if the player owns zero territories, the target is in the configured starter allow-list,
8. otherwise the target is adjacent to at least one player-owned territory through accepted `grid_territory_edges`,
9. idempotency key has not already produced a different command result.

Successful claim settles resources first, deducts configured costs, changes ownership, and appends `grid:territory_claimed` atomically.

The first-player experience must not become a speed-click race; starter eligibility is configuration and later UI may present a limited valid set.

## 9. Property acquisition invariants

Property acquisition is server-authoritative and season-scoped.

For the initial non-auction acquisition path in this phase:

- season active,
- player joined,
- property belongs to the season city,
- property is available,
- player controls the containing territory unless season configuration explicitly permits another acquisition mode,
- configured acquisition cost is payable,
- resources settle before ownership changes,
- mutation + `grid:property_acquired` event are atomic/idempotent.

Auction mechanics are explicitly deferred to a later phase even though the design anticipates them.

## 10. Property development

Five universal branches:

- `commerce`
- `influence`
- `fortress`
- `intel`
- `prestige`

A property's branch and current level are state. Allowed level count, next-level Credit/Command Point costs, yields, and bonuses come from the active season's configuration table.

A development action:

1. settles resources,
2. verifies player owns the property,
3. verifies requested branch/next level is allowed,
4. pays configured costs,
5. updates branch/level,
6. appends `grid:property_developed` atomically.

Changing branch after development is not allowed unless a later explicit respec mechanic is designed.

Fortress/Intel/Prestige data may be stored/calculated now, but contest/fog/City-Power effects are not activated until their owning phases.

## 11. Skyline engine

Skyline topology is a pure deterministic graph calculation over:

- player-owned properties,
- each property's containing territory,
- accepted territory adjacency edges,
- development branch/level.

It returns connected components and descriptive metrics independent of Canton.

Whether a component qualifies for a bonus, and what that bonus is, comes entirely from season configuration. No fixed minimum size or multiplier exists in Core.

The derived projection may emit `grid:skyline_formed` only when persistence detects a transition into a newly qualifying configured Skyline state; repeated reads never append events.

## 12. Immutable event vocabulary for this phase

At minimum:

- `grid:season_joined`
- `grid:resources_settled`
- `grid:territory_claimed`
- `grid:property_acquired`
- `grid:property_developed`
- `grid:skyline_formed`

Event payloads contain IDs/slugs, before/after resource deltas, configured costs/rates used, and correlation/idempotency context sufficient for audit/replay. No private residential names are introduced into public payloads.

## 13. Player-visible projection

This phase may expose a **read-only Grid world projection** behind the Grid feature/development boundary:

- season status,
- joined player wallet,
- territory neutral/player control,
- property availability/owner/development branch/level,
- derived Skyline components,
- valid neutral claims for the current player.

The final 2.5D map renderer remains roadmap item 4. Phase 2 needs a stable projection/API that the later renderer can consume without rewriting economy logic.

## 14. Deterministic simulation

Add a seedable economy simulation using synthetic geography/player strategies. It must exercise:

- joins,
- regeneration/settlement,
- first claims,
- adjacency expansion,
- property acquisition,
- development branches,
- Skyline detection,
- resource faucets/sinks over a season-length configured window.

Simulation reports, but does not hardcode as pass/fail until tuning is approved:

- resource supply over time,
- holdings concentration,
- claim pace,
- upgrade ROI by branch,
- inactive/offline accumulation behavior,
- leader concentration / Gini-like measures,
- time-to-first-claim/property/upgrade/Skyline.

Hard acceptance checks are structural: deterministic replay for same seed/config, no negative resources, no double ownership, no impossible non-adjacent expansion, and ledger/event invariants.

## 15. Dependency-ordered implementation tasks

### Task 1 — Economy contracts + config validation

**Files:**
- `lib/grid/core/economy-types.ts` (new)
- `lib/grid/core/types.ts` (extend season template optionally)
- `lib/grid/core/city-package.ts` (economy config validation when present)
- `tests/grid-economy-contracts.test.ts` (new)

**Acceptance:** legacy packages still validate; malformed economy config fails; no Canton strings in Core.

### Task 2 — Deterministic resource/development/Skyline primitives

**Files:**
- `lib/grid/core/resources.ts` (new)
- `lib/grid/core/development.ts` (new)
- `lib/grid/core/skyline.ts` (new)
- focused tests

**Acceptance:** integer deterministic math, CP cap semantics, capped offline accrual, explicit development tables, deterministic connected components.

### Task 3 — Season ownership state migration

**Files:**
- new additive `supabase/migrations/*_grid_season_economy.sql`
- `tests/grid-economy-schema-contract.test.ts`

**Acceptance:** composite city consistency, uniqueness, checks, RLS/revokes, settlement timestamp, from-scratch local migration success. No production migration.

### Task 4 — Join + resource settlement transaction boundary

**Files:**
- `lib/grid/server/economy-port.ts`
- `lib/grid/server/economy-service.ts`
- Supabase adapter / reviewed RPC migration additions
- tests

**Acceptance:** join idempotent; starter resources only once; lazy settlement deterministic; event is atomic with mutation; production target guarded.

### Task 5 — Neutral territory claims + control projection

**Files:**
- claim domain/service + Supabase transaction adapter
- read-only territory-control projection
- tests

**Acceptance:** starter allow-list, adjacency after first claim, atomic cost/ownership/event, race/idempotency tests, no negative resources/double ownership.

### Task 6 — Property acquisition + development + Skyline projection

**Files:**
- property service/port
- development transaction adapter
- Skyline projection/event transition logic
- tests

**Acceptance:** containing-territory rule, configured acquisition costs, five branches, no hidden tier constants, atomic events, deterministic Skyline topology.

### Task 7 — Deterministic economy simulation + Canton tuning seed

**Files:**
- `lib/grid/sim/economy-sim.ts`
- tests/report script
- `lib/grid/cities/canton/founding-season.ts` economy configuration
- tuning record doc

**Acceptance:** deterministic same-seed replay; structural invariants always hold; initial Canton values are explicitly documented as tunable and supported by simulation output.

### Task 8 — Read-only player-visible Grid projection + final acceptance

**Files:**
- Grid read projection/API under development/feature boundary
- `/grid` integration appropriate to current visual stage
- acceptance tests/doc

**Acceptance:** player can see real Canton territories and ownership state without browser mutation authority; focused Grid tests, lint, build, architecture grep all pass; no production economy activation without separate approval.

## 16. Final phase gate

Phase 2 is accepted only when:

1. all `tests/grid-*.test.ts` pass,
2. all economy commands are deterministic/idempotent and server-authoritative,
3. local database migrations reset/apply from scratch,
4. concurrency tests prove neutral territory/property cannot be double-owned,
5. resources cannot become negative,
6. first claim + later adjacency rules are enforced,
7. five development branches are config-driven,
8. Skyline topology is deterministic and bonuses are config-driven,
9. simulation same seed/config yields identical results,
10. `grep -rniE "canton|stark county|ohio" lib/grid/core lib/grid/server` finds no city leakage except explicitly city-scoped modules,
11. `npm run lint` and `npm run build` pass,
12. no production economy migration/activation occurs without a separate explicit human approval gate.

## 17. Agent review note

AGY reviewed the architecture before this plan was written and agreed with the dependency shape (contracts → pure engines → state schema → authoritative services → simulation → tuning). Its review proposed several example balance numbers. Those numbers were intentionally **not accepted** because the approved design does not specify them; this plan keeps them configuration until simulation and human tuning.
