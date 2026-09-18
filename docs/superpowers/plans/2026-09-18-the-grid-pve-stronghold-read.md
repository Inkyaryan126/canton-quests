# Grid PvE Stronghold Contest Read / Resume

## Goal

Let authenticated players rediscover an active NPC stronghold fight after navigation, refresh, reconnect, or app relaunch without exposing database identifiers or another player's state.

## Read model

The player-facing view contains the opaque contest id required for subsequent round commands, stronghold/faction identity, source/target territory slugs, optional landmark slug, commitment/remaining Influence, round number, status, and timestamps. It omits season/city UUIDs, attacker player UUID, event ids, and raw ledger payloads.

## Authorization

- List reads are adapter-filtered to the authenticated attacker and current city/season, then fail closed if a returned row belongs to anyone else or is not active.
- Detail reads fetch by opaque contest id inside the current city/season. The service compares `attackerPlayerId` to the authenticated viewer and returns the same `NOT_FOUND` result for missing and other-player contests, avoiding contest-id existence disclosure.
- Routes require `GRID_WORLD_READ_ENABLED` and authentication.

## Territory identity

The Supabase adapter resolves internal source/target territory UUIDs to city-package-compatible slugs before returning a context to the service. UUIDs never enter the HTTP response.
