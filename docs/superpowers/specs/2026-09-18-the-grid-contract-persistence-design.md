# The Grid Contract Persistence Boundary

## Decision

Contract progress is persisted behind a server-only `GridContractPersistencePort`.
The Supabase adapter reads the scoped instance and sends only the trusted event
fields to `grid_commit_contract_progress`; it never sends completion or reward
claims.

The database RPC owns the compare-and-swap transition, replay event, and
completion reward outbox inserts in one transaction. The `(season_id,
idempotency_key)` constraint makes an exact replay return the original result,
while the additive reward key and contract/reward unique index prevent a second
outbox row. Outbox consumers must acknowledge `reward_key` idempotently.

## Boundaries

- Contract definitions are resolved server-side before progress is applied.
- Clients cannot read or write the persistence tables or invoke the RPC.
- Conflicts return the locked current instance for the bounded service retry.
- Reward delivery remains a separate worker concern; this lane only guarantees
  durable, exactly-once outbox issuance.
