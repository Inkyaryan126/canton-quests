# Grid NPC Stronghold Registry

## Goal

Replace route-local/empty stronghold arrays with a data-driven season registry while avoiding invented Canton launch tuning.

## Definition storage

`grid_npc_stronghold_definitions` stores season/city-scoped stronghold identity, faction, real territory/optional landmark references, activation mode, garrison tuning, reinforcement tuning, and an `enabled` switch. Definitions default to disabled and this migration seeds none.

A validation trigger guarantees the referenced territory belongs to the definition city and an optional landmark belongs to that same territory. Only one enabled stronghold may target a territory in a season.

## Runtime separation

Definitions are configuration, not transient state. Runtime signals are supplied by the caller:
- whether the season is active;
- which event-gated strongholds are currently activated;
- Surge intensity basis points;
- faction-pressure basis points by faction.

Captured state is derived from completed `grid_pve_stronghold_contests`, not a mutable flag on the definition.

`listGridNpcStrongholdRuntimeInputs()` produces the exact `{config, context}` inputs already consumed by the world projector. `resolveGridNpcStrongholdFromRegistry()` produces one Core projection for the trusted PvE combat resolver.

## Integration boundary

The active canonical integration lane owns `/api/grid/world`, so this checkpoint does not edit that route. Once merged, the route can replace its current empty stronghold input with registry runtime inputs. Event/Surge/faction-pressure wiring must use authoritative signals; it must not synthesize arbitrary tuning client-side.
