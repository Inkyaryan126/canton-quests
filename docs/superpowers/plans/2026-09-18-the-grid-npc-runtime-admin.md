# Grid NPC Runtime Admin Controls

## Goal

Make the audited NPC runtime evidence commands operable through authenticated Game Master APIs without raw SQL and without inventing an automatic faction-pressure formula.

## Readiness

`GET /api/admin/grid/stronghold-runtime` uses the same registry + evidence readiness service as player/world projection. It reports:
- `ready` or `incomplete`;
- exact missing evidence facts for operators;
- when ready, normalized runtime signals and each enabled stronghold's activation/target/captured/event/pressure context.

This is an operator surface, so exact missing facts are appropriate here even though player APIs keep them private.

## Mutations

- `POST /api/admin/grid/stronghold-runtime/surge` sets `surgeIntensityBps` (`0..10000`) or `null` to clear evidence back to unknown.
- `POST /api/admin/grid/stronghold-runtime/factions/[factionId]/pressure` sets faction pressure basis points.
- `POST /api/admin/grid/stronghold-runtime/strongholds/[strongholdId]/event` sets explicit event activation true/false.

Routes resolve the current city/season from server configuration, never accept city/season ids from the client, bind no player actor, and delegate to the NPC 11 command service/RPCs for range validation, idempotency, stale-write protection, advisory locking, and immutable event logging.

All routes require the canonical admin session, `GRID_WORLD_READ_ENABLED`, and no-store responses.
