# Grid NPC Runtime Evidence Commands

## Goal

Make NPC strategic evidence writable by trusted engine/admin code without raw table mutation, stale overwrites, or invisible state changes.

## Commands

- Surge intensity: `0..10000` basis points or `null` to intentionally clear the evidence back to unknown.
- Faction pressure: `0..10000` basis points for one season/faction.
- Stronghold event state: explicit true/false for a registered season stronghold.

All three commands:
- require season/city identity;
- use a per-signal transaction advisory lock;
- reject writes older than the currently stored `updated_at`;
- reconcile exact idempotent retries through `grid_game_events`;
- reject idempotency-key reuse with different payload/actor;
- append a season event after the state mutation in the same transaction;
- are executable only by `service_role`.

Because the existing world revision signal hashes the latest season event cursor, these runtime changes will naturally invalidate the world read once stronghold registry wiring is added.
