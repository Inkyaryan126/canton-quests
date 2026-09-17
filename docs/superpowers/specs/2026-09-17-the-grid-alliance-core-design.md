# The Grid Alliance Core Design

**Status:** APPROVED FOR LOCAL IMPLEMENTATION — 2026-09-17

## Goal

Add the first city-agnostic Alliance mechanics to Grid Core without touching persistence, APIs, UI, Canton tuning, or another agent's active lane.

The approved player rule is one active Alliance per player per season. Leaving starts a cooldown before the player may join any Alliance again.

## Chosen approach

Build a pure deterministic core. Alliance state is passed in and projected out; no database, clocks, random values, network calls, or city-specific imports live in this lane.

This is preferred over a membership-only stub because Alliances must matter on the map, and preferred over a full vertical slice because persistence/API/UI are separate future lanes with higher collision risk.

## In scope

- membership eligibility and one-Alliance-per-season enforcement
- deterministic leave cooldowns
- configurable member capacity
- bounded pooled Influence contributions
- coordination/upkeep cost projection and settlement
- connected Alliance Network projection from personal territory ownership
- strict validation, safe-integer math, and deterministic ordering

## Explicitly out of scope

- Supabase schema, migrations, RLS, or RPCs
- Alliance creation/invitations/admin lifecycle
- public Alliance pages, chat, emblems, or UI
- pooled Credits or Command Points
- withdrawals, player-to-player transfers, or markets
- coordinated contest commands or shared defense execution
- Alliance projects/megaprojects and diplomacy
- production activation or deployment

## Core invariants

1. Personal territory, property, Credits, and progression remain personal.
2. A player may have at most one active membership in a given season.
3. Leaving creates a rules-driven cooldown; the boundary is inclusive, so joining is allowed at `cooldownUntil`.
4. The cooldown applies to every subsequent Alliance join, including rejoining the prior Alliance, preventing leave/rejoin exploits.
5. The Alliance Influence pool can never exceed its configured cap or go below zero.
6. Contributions never mint Influence: accepted Influence cannot exceed the requested amount, player balance, or remaining pool capacity.
7. Upkeep never creates debt; unpaid cost is exposed as deterministic shortfall.
8. Alliance Networks are derived from member-owned territories and accepted territory adjacency only; ownership itself is never changed.
9. All numeric gameplay state uses non-negative safe integers; all tuning is supplied through rules/configuration.
10. `lib/grid/core/**` remains free of Canton/Ohio/Stark-specific logic.

## Rules contract

`GridAllianceRules` supplies all tuning needed by the pure core:

- `maxMembers`
- `leaveCooldownSeconds`
- `influencePoolCap`
- `baseUpkeepInfluencePerTick`
- `memberUpkeepInfluencePerTick`
- `disconnectedComponentUpkeepInfluencePerTick`
- `largeAllianceThreshold`
- `largeAllianceSurchargeInfluencePerMemberPerTick`

A tick is an external settlement unit. The core accepts an integer `ticks` count rather than deciding when ticks happen.

## Membership flow

`evaluateGridAllianceJoin` receives player, season, target Alliance, active membership history, target member count, rules, and an explicit `now` timestamp.

It rejects missing identifiers, full Alliances, an existing active membership in the same season, and an unexpired leave cooldown. Different seasons do not conflict.

`leaveGridAlliance` closes an active membership at an explicit timestamp and returns `cooldownUntil`. It does not choose a new leader or mutate persistence.

## Influence pool

`contributeGridAllianceInfluence` accepts a requested amount plus current personal and pooled Influence. It transfers only the amount that actually fits and reports whether player balance or pool capacity constrained the contribution.

No withdrawal primitive is included in this phase; pooled Influence is reserved for future Alliance actions and upkeep so the first core cannot become a laundering path.

## Alliance Network projection

`projectGridAllianceNetwork` receives active member IDs, territory ownership records, and accepted adjacency edges.

Only territories personally owned by active members enter the network. The function builds undirected connected components, sorts slugs inside each component, and sorts components deterministically.

Projection exposes:

- all controlled territory slugs
- connected components
- component count
- largest component size
- isolated territory slugs
- disconnected component count (`max(componentCount - 1, 0)`)

This makes Alliances map entities while preserving individual ownership.

## Coordination upkeep

Per tick upkeep is:

`base + (members * perMember) + (disconnectedComponents * disconnectedPenalty) + (membersAboveThreshold * largeAllianceSurcharge)`

`calculateGridAllianceUpkeep` projects the amount for `ticks`; `settleGridAllianceUpkeep` pays from the pool without debt and returns paid amount, remaining pool, and shortfall.

This gives large or fragmented Alliances meaningful coordination cost without granting smaller players free wins.

## Failure handling

Invalid contracts throw descriptive errors. Normal gameplay denials such as `already-in-alliance`, `alliance-full`, and `cooldown-active` are returned as typed decisions rather than exceptions.

Timestamp parsing is deterministic from caller-supplied ISO values. Arithmetic that would exceed JavaScript safe-integer range is rejected instead of rounded.

## Test strategy

The focused core suite must prove:

- one active Alliance per season and independent memberships across seasons
- leave cooldown rejection and exact-boundary acceptance
- capacity enforcement
- bounded contributions with no resource creation
- stable network components across reordered inputs
- non-member territories cannot bridge a network
- upkeep increases for large and fragmented Alliances
- settlement exposes shortfall without negative pool state
- malformed rules and unsafe integers fail closed

Final verification also runs `git diff --check`, focused Alliance tests, TypeScript, lint, a Grid core regression subset, and a Canton/Ohio/Stark leak grep over the two new core files.

## Follow-on lanes

Future persistence, APIs, player UI, Alliance projects, coordinated contests, and public map overlays should consume this core contract rather than reimplement its rules.
