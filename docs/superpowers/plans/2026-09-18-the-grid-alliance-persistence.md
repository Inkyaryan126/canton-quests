# The Grid Alliance Persistence Plan

## Task 1 — schema contract
- Add `grid_alliances` and `grid_alliance_memberships`.
- Enforce seasonal membership uniqueness and membership/Alliance season consistency.
- Persist pool/revision state without pooled Credits or Command Points.
- Enable RLS and revoke direct browser-role access.

## Task 2 — adapter boundary
- Add typed Alliance persistence port.
- Add Supabase service-role adapter for state reads and optimistic writes.
- Normalize rows into the verified pure-core contracts.

## Task 3 — server commands
- Consume the pure Alliance core for membership eligibility and leave cooldowns.
- Fail closed on concurrency conflicts.
- Keep all resource-changing commands server authoritative.


## Task 4 — pooled Influence contribution
- Evaluate requested contributions with the deterministic Alliance core.
- Require active membership and a live player-season Influence balance.
- Apply the exact decision through a locked optimistic RPC.
- Record/replay successful transfers through the game-event idempotency ledger.
- Never mutate Credits or Command Points.


## Task 5 — coordination upkeep settlement
- Derive active members from persisted membership state.
- Project network fragmentation from live seasonal territory ownership and city adjacency.
- Calculate upkeep with the deterministic Alliance core.
- Persist the exact pool settlement through an optimistic idempotent RPC.
- Record paid Influence and shortfall without creating debt or touching personal Credits/Command Points.
