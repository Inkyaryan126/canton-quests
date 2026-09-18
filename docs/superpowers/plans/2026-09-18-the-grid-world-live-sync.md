# Grid World Live Sync

## Goal

Close the Phase-4 realtime read loop without turning the City Board into a bandwidth-heavy polling client.

## Behavior

- The existing full `/api/grid/world` projection remains the only payload that updates board state.
- Authenticated players with runtime reads enabled poll `/api/grid/world/revision` instead of repeatedly downloading the full world.
- The revision endpoint's ETag is sent back with `If-None-Match`; `304` schedules the next cheap check and does not reload the board.
- A changed revision triggers one fresh `/api/grid/world` read.
- Hidden/background tabs suspend active polling and use a 30-second backoff; returning to the tab triggers an immediate revision check.
- `401` and `404` stop the revision loop rather than creating retry noise.
- Transient revision-check failures keep the already-rendered board and back off rather than replacing working content with an error state.

## Boundaries

No mutation authority moves to the client. No realtime subscription credentials, raw event ledger rows, player IDs, or private event payloads are exposed.
