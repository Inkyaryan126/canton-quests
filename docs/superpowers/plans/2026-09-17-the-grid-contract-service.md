# The Grid Contract Service

## Goal

Progress player contracts through a server-only command boundary without trusting client definitions, losing completion rewards, or double-granting retries.

## Architecture

`progressGridContract` resolves the contract definition from a server-side catalog using city + season + contract IDs. It then loads the player's versioned contract instance and applies the deterministic Contract Core transition.

The persistence port receives one atomic commit containing:

- scoped city/season/player/contract identifiers
- the trusted event idempotency key
- expected instance version
- the next contract state
- base completion reward intent
- optional location bonus intent

The adapter implementing `commit` must compare-and-swap the state and enqueue reward intents in the same transaction. Reward delivery happens later from that durable outbox.

## Concurrency and retries

Optimistic conflicts cause the service to reload current state and reapply the same trusted event. The retry count is bounded. Exact event replays return `duplicate` and the service never claims that rewards were queued again.
## Security boundary

This service is for trusted server event routing only. No client API should accept arbitrary `objectiveId`, `amount`, reward values, or contract definitions and pass them through unchanged.

Future event routing should map verified Grid game events to progress commands on the server. The catalog and stored instance remain authoritative.

## Deliberately not included

- Supabase schema/adapter
- public API route
- contract discovery/assignment
- reward outbox worker
- arbitrary client progress submission

## Next recommended milestone

Add the Supabase persistence adapter and additive migration that enforce city/season/player scoping, unique idempotency keys, optimistic versions, and atomic completion-reward outbox writes. Keep production migration/deploy out of scope until explicitly approved.