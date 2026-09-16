# THE GRID — Season Economy + Ownership Phase Acceptance

**Date:** 2026-09-15
**Accepted checkpoint:** `841caf2` (`GRID Economy 8: add read-only Canton world projection`)
**Status:** ACCEPTED LOCALLY / BACKED UP TO GITHUB / NOT PRODUCTION-ACTIVATED

## 1. Phase result

Roadmap Phase 2 is complete at the code/local-runtime level. The accepted loop is now:

**join season → settle resources → claim neutral territory → expand by adjacency → acquire property → develop a branch → form Skylines → project the live city board**

This checkpoint deliberately stops before contests/Signal Dice/attacks and defense, auctions, alliances, Surge mechanics, NPC factions, and the final 2.5D renderer.

## 2. Accepted implementation commits

| Commit | Accepted capability |
|---|---|
| `f56b293` | Economy contracts and city/season config validation |
| `8dd58f8` | Deterministic Credits/Influence/Command Point settlement, development math, and Skyline primitives |
| `f635cf8` | Season-scoped territory/property ownership schema and deterministic accrual state |
| `5c01929` | Atomic season join and resource-settlement commands |
| `0172d3a` | Neutral territory claiming with starter/adjacency rules |
| `db6615c` | Property acquisition and five-branch development commands |
| `5f0d6b5` | Deterministic economy simulation plus Canton Founding Season tuning |
| `841caf2` | Read-only Canton world projection and player-visible Grid City Board |

All eight commits are now backed up on the remote Grid branch `boardroom/astra-overnight-20260913-015618-c5cc`.

## 3. Economy/resource model accepted

The reusable engine now has three distinct strategic resources:

- **Credits** — economic resource.
- **Influence** — strategic control resource.
- **Command Points** — pacing resource with deterministic time regeneration.

Important accepted invariants:

- starter resources are granted once when a player joins a season;
- exact command retries are idempotent and cannot double-grant/double-charge;
- Command Point regeneration uses whole configured intervals and cannot bank hidden overflow while already capped;
- Credits/Influence accrual uses integer remainder accounting, so frequent settlement cannot lose fractional income;
- offline accrual uses an explicit configured cap rather than a hidden default;
- ownership/development mutations settle the player's economy to the mutation time before changing holdings;
- important mutations are server-authoritative and write immutable `grid_game_events` in the same database transaction.

## 4. Territory control accepted

Neutral claiming is implemented as the first city-control action.

- A player's first territory must come from the season-configured starter set.
- After the first claim, normal expansion requires an accepted adjacency edge to player-owned territory.
- Claimed territories are season-scoped; global city geography is never rewritten by gameplay.
- Target ownership is transactionally locked so two players cannot successfully claim the same neutral territory.
- Claim costs come from configuration.
- Insufficient Credits/Command Points, wrong-city targets, occupied targets, inactive seasons, and invalid expansion fail without partial wallet/ownership/event side effects.
- Successful claims append `grid:territory_claimed` atomically.

The pure territory-control projection deterministically reports player ownership, neutral territories, and valid next claims.

## 5. Properties and development accepted

Properties can be acquired and developed through five universal branches:

- `commerce`
- `influence`
- `fortress`
- `intel`
- `prestige`

Development is table/config driven. Core contains no hidden exponential cost formula and no hardcoded maximum development tier.

The accepted property command layer provides server-authoritative acquisition/development transactions with configuration-driven costs, ownership checks, resource settlement, idempotency, and immutable ledger events.

Skyline topology is deterministic over developed player-owned properties connected through territory adjacency/same-territory topology. Qualification thresholds and bonuses come from season configuration instead of fixed Core constants.

## 6. Canton Founding Season tuning accepted as tunable

`lib/grid/cities/canton/founding-season-economy.ts` contains Canton's initial Founding Season economy tuning. Those numbers are **city/season tuning**, not universal Grid rules.

The deterministic economy simulator exercises joining, resource regeneration, claims, expansion, property acquisition, development, Skyline behavior, and offline accrual over a configured season window.

The simulation acceptance suite verifies:

- same seed + same config replays identically;
- a different seed changes trajectory;
- ownership/resource/adjacency structural invariants hold through a full simulated season;
- tuning reports include snapshots, saturation milestones, and branch ROI;
- slower/offline players exercise the configured offline accrual cap;
- the configured six-slot starter seed gives each simulated player a valid starter opportunity.

Balance outputs remain tuning evidence, not permanent universal constants.

## 7. Player-visible world projection accepted

Economy 8 adds a read-only world projection contract plus a City Board client.

When the Grid read feature is enabled and matching runtime data exists, `/api/grid/world` can project:

- real compiled Canton territory geometry;
- neutral/owned/occupied territory state;
- current player's wallet;
- valid expansion targets;
- property availability/ownership/development state;
- qualified Skyline information.

The projection intentionally minimizes information leakage:

- rival player IDs are not exposed; rival control is represented as `occupied`;
- private property names remain sanitized;
- the world endpoint is GET/read-only;
- the projection adapter contains no gameplay insert/update/delete/upsert/RPC mutation path.

This contract gives the later 2.5D renderer a stable game-state source without moving economy rules into UI code.

## 8. Database/security boundary

Accepted database design keeps gameplay state separate from source geography and production activation.

- `grid_season_territory_state` owns seasonal territory control.
- `grid_season_property_state` owns seasonal property/development state.
- `grid_player_season_state` holds season wallet/pacing/accrual state.
- `grid_game_events` remains the immutable audit ledger.
- mutation RPCs are server/service-role boundaries rather than browser mutation APIs.
- state-changing transactions combine wallet/state/event writes atomically.
- browser roles do not receive direct mutation rights to the accepted economy/ownership state.

No production Supabase migration or economy activation is part of this acceptance checkpoint.

## 9. Architecture boundary

Economy/ownership behavior remains city-agnostic in reusable Core/server modules. Canton-specific starting/tuning values live under `lib/grid/cities/canton/**`.

The acceptance architecture check scans reusable `lib/grid/core` and `lib/grid/server` for `canton|stark county|ohio`. City-specific knowledge is expected only in explicit city/projection composition boundaries, not reusable economy rules.

## 10. Independent acceptance verification — 2026-09-15

A separate clean Git worktree was created directly from committed checkpoint `841caf2`, leaving ongoing contest/road-network work untouched.

Verified on that isolated checkpoint:

```text
Test Files  31 passed (31)
Tests       218 passed | 2 skipped (220)
```

The two skipped tests are the existing guarded local-Supabase integration cases; they are not silently forced against a remote database.

Additional acceptance gates in the same clean worktree:

- ESLint: clean.
- TypeScript `tsc --noEmit`: clean.
- Next.js optimized production build: verification run completed as part of this acceptance pass.
- Core/server city-leak grep: clean at the accepted city-agnostic boundary.
- Economy 5–8 commits: fast-forward backed up to GitHub before any later phase work.

## 11. Production status

The informational public `/grid` build surface may exist on `main`, but **the Economy 1–8 gameplay branch itself is not production-activated by this acceptance**.

This checkpoint does not:

- run a linked/production Supabase migration;
- activate a production Grid season;
- grant production players Grid wallets;
- allow production territory/property mutation;
- expose unfinished contest systems;
- claim that the final renderer/game is complete.

## 12. Next roadmap phase

With Phase 2 accepted, later work can build on stable contracts rather than rewriting the economy foundation. The next gameplay layer can add:

**contests → Signal Dice → attack/defense → asynchronous pressure → auctions/trading → alliances → Surge → NPC factions → final 2.5D city renderer**

The economy, ownership, simulation, and projection contracts should be treated as the accepted baseline unless later tests demonstrate a concrete incompatibility.
