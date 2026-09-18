# Grid NPC Stronghold Definition Admin Lifecycle

## Goal

Let trusted operators configure season strongholds without raw SQL and without silently inventing Canton tuning.

## Lifecycle

- Upsert accepts explicit stronghold/faction/territory/optional-landmark identity, activation mode, garrison tuning, and reinforcement tuning.
- New definitions are inserted disabled. Enabling is a separate command.
- Once a stronghold has any PvE contest history, changing faction, target, activation, or tuning is rejected. This prevents historical stronghold identity from drifting to a new target or balance profile after players have fought it.
- An exact same configuration may still be re-submitted with a new audit event.
- Disabling is blocked while that stronghold has an active contest. Enabling/disabling after historical contests is allowed because it changes operational availability, not historical identity.
- No delete command is provided.

## Auditing and safety

Both mutation RPCs use per-stronghold advisory locks, append immutable `grid_game_events`, reconcile exact idempotent retries, reject key collisions, and are executable only by `service_role`.

## Admin API

- `GET /api/admin/grid/strongholds` lists all current-season definitions, including disabled entries, with territory/landmark slugs plus `hasContestHistory` and `activeContest` operator signals.
- `POST /api/admin/grid/strongholds` creates or tunes a definition from explicit operator values.
- `PATCH /api/admin/grid/strongholds/[strongholdId]/enabled` changes only operational enabled state.

Routes require the canonical admin session and the Grid runtime feature gate. They never seed a default Canton stronghold automatically.
