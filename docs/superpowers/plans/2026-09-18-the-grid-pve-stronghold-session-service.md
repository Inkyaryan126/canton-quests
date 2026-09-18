# Grid PvE Stronghold Session Service

## Goal

Keep PvE stronghold combat server-authoritative before persistence/API wiring exists.

## Trust boundary

The client may provide only attacker identity (from auth at the route), source territory, stronghold id, committed Influence, an idempotency key, and command time. It never supplies:
- NPC faction identity;
- target territory identity;
- objective/landmark identity;
- garrison Influence;
- Signal Dice results.

`getStartContext()` is a trusted server adapter boundary that must resolve the requested stronghold against approved city/season configuration and authoritative territory state. The service validates identity echo, then snapshots the Core stronghold contest state and sends the canonical values to persistence.

Round resolution reads persisted remaining Influence from the port, verifies the authenticated attacker, derives the permitted attacker/garrison dice counts from the shared contest config, generates all rolls from the server `GridSignalDiceRoller`, and submits only those server rolls to the atomic persistence layer.

## Next slice

Add a dedicated `grid_pve_stronghold_contests` table and service-role RPCs for idempotent start/round settlement. Do not modify the PvP `grid_contests.defender_player_id` invariant.
