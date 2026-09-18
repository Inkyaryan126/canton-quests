# Grid NPC Stronghold Runtime Readiness

## Goal

Prevent enabled stronghold definitions from being projected or fought using fabricated zeroes when strategic runtime evidence has not been implemented yet.

## Evidence

The runtime evidence port supplies nullable authoritative facts:
- season active/inactive;
- Surge intensity basis points;
- event activation state by event-gated stronghold;
- faction-pressure basis points by faction.

Known values are always validated. Requirements are definition-aware:
- Surge evidence is required only for Surge-gated definitions or definitions with nonzero Surge reinforcement.
- Event evidence is required only for event-gated definitions.
- Faction pressure is required only when a definition has nonzero pressure reinforcement.

If the season is authoritatively inactive, other strategic signals are irrelevant and safely normalize to false/zero because no uncaptured stronghold can become contestable. Empty registries also return ready without querying evidence.

## Full world vs one combat target

The world feed calls `readGridNpcStrongholdRuntimeReadiness()` and therefore requires evidence for every enabled definition it intends to show. PvE combat calls `resolveGridNpcStrongholdRuntimeReadiness()` scoped to one stronghold, so an unrelated event stronghold with missing evidence does not block a valid season stronghold fight.

Incomplete readiness returns explicit `missingFacts` and no projection. The caller should surface a runtime warning/fail closed, not substitute defaults.
