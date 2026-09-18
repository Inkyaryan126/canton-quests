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
