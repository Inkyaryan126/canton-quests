# The Grid — Dominance Heat to NPC Pressure

## Goal

Make the first Dominance Heat effect mechanically real without taking control
away from Game Masters.

NPC strongholds already consume factionPressureBps when calculating garrison
reinforcement. Before this lane, that value existed only as explicit runtime
evidence written by an operator. Missing pressure made a pressure-sensitive
stronghold incomplete.

## Authority order

Faction pressure now resolves in this order:

1. Explicit GM grid_npc_faction_pressure_state value, when present.
2. For an active Canton season only, a deterministic Dominance Heat fallback.
3. Outside Canton, missing pressure remains missing instead of inventing policy.

A GM may therefore override automatic pressure with any valid explicit value,
including zero.

## Dominance fallback

The fallback uses authoritative database state:

- eligible Canton territories from grid_territories
- current player ownership from grid_season_territory_state
- active Alliances from grid_alliances
- active member rosters from grid_alliance_memberships

It computes personal and Alliance territory concentration using the same Canton
Dominance Heat config as the player Heat screen.

The strongest live concentration supplies that Heat band's
neutralFactionPressureBps. That value is used as the missing faction-pressure
signal for each requested NPC faction.

The derived value is not persisted into the GM runtime table. It is read-time
evidence, so an explicit GM command can take precedence immediately.

## Mechanical effect

The existing stronghold engine multiplies faction pressure by each stronghold's
pressureReinforcementBps and converts the result into real garrison Influence.

A focused integration test demonstrates the same 40-base / 80-max stronghold
moving from:

- 40 Influence while city concentration is below Heat
- 42 at Warm
- 44 at Hot
- 50 at Critical

That garrison value is the one committed when a PvE stronghold contest starts.

## Current limits

The Heat source remains territory share only. Canton still has no authoritative
persisted strategic-value score per territory.

This lane only activates the NPC-pressure effect. Other configured Dominance
Heat effects—upkeep surcharge, border rewards, rival objective bonuses, and
anti-monopoly Contract slots—remain projected until their own authoritative
gameplay paths consume Heat.
