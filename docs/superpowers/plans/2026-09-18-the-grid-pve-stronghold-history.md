# Grid PvE Stronghold Battle History

## Goal

Project immutable PvE stronghold ledger events into an attacker-only battle timeline suitable for a player-facing battle screen.

## Authorization

The adapter scopes the contest lookup to the configured city/season. The service returns the same `NOT_FOUND` response for a missing contest and a contest owned by another attacker, preventing opaque-id existence disclosure.

## Allow-listed projection

The HTTP timeline never returns raw `grid_game_events.payload`, event UUIDs, actor UUIDs, idempotency keys, source/target territory UUIDs, or arbitrary future fields.

Known events become typed views:
- `started`: stronghold/faction/objective identity and initial attacker/garrison commitments;
- `round`: round number, status, server dice, mapped attacker/garrison comparisons, losses, remaining Influence, refund, capture result;
- `withdrawn`: stronghold id, attacker refund, remaining NPC garrison.

Ledger payloads are validated while projecting. Malformed authoritative history fails closed rather than silently omitting or leaking fields.

`GET /api/grid/stronghold-contests/[contestId]/history` requires authentication plus `GRID_WORLD_READ_ENABLED`.
