# The Grid — Contract Reward Settlement

Contract completion already writes durable reward intents into
grid_contract_reward_outbox. This lane turns those intents into exactly-once
player resource payouts.

## Source of truth

The settlement API never accepts reward amounts, player IDs, season IDs, or
outbox IDs from an operator. It only triggers a bounded scan of pending outbox
rows.

Each payout RPC locks one outbox row and reads the reward JSON that was written
atomically by grid_commit_contract_progress when the Contract completed.

The reward schema is strict: Credits, Influence, and Command Points are
non-negative integer fields and no extra reward keys are accepted.

## Exactly-once behavior

Each outbox row uses a deterministic game-event idempotency key based on its
outbox UUID.

The same database transaction:

- locks the pending reward row
- validates season/player/resource state
- applies Credits and Influence
- adds Command Points up to the configured season maximum
- marks the outbox row processed
- appends grid:contract_reward_settled

A concurrent or repeated processor sees processed_at and returns the immutable
event as a duplicate. If processed_at exists without the matching audit event,
settlement fails closed.

## Season boundary

Rewards may settle while a season is active, in Surge, or complete. They do not
settle in draft, scheduled, or archived seasons.

This is intentional: Season Archive already refuses to archive while a Contract
reward remains pending, so completed rewards cannot be silently buried.

## Operations

POST /api/admin/grid/contracts/rewards/settle requires existing admin
authentication and GRID_CONTRACT_REWARD_SETTLEMENT_ENABLED=1.

The only caller-controlled field is an optional batch limit. The service scans
oldest pending rewards first, continues after an individual malformed reward,
and returns failures for reconciliation.

The database RPC is executable only by service_role.
