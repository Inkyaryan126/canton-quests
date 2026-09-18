# Grid World Revision Signal

## Goal

Add the smallest safe realtime primitive needed by mobile Grid clients: a cheap authenticated endpoint that tells the client whether the persistent city changed since its last full world projection.

## Boundaries

- Do not expose raw event payloads, player IDs, entity IDs, or event IDs.
- Reuse the existing `GRID_WORLD_READ_ENABLED` gate.
- Do not touch the City Board, map renderer, onboarding, or return UI while those lanes are owned elsewhere.
- Do not add a migration; `grid_game_events` is already the canonical immutable change ledger.

## Contract

The server reads the configured city/season, its season status/update timestamp, and only the newest event id/timestamp. The service hashes those values into an opaque revision token. Active or Surge seasons recommend a 5-second poll; inactive seasons recommend 30 seconds.

`GET /api/grid/world/revision` requires an authenticated player. It returns an ETag matching the opaque revision. A client that sends the same value in `If-None-Match` receives `304 Not Modified`, avoiding a full world payload until something actually changes.
