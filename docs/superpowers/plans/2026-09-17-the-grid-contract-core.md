# The Grid Contract Core

## Goal

Establish the first reusable Grid contract/objective state machine without touching legacy Canton Quests missions or any active Grid persistence/UI lane.

## Checkpoint contents

- `lib/grid/core/contract-types.ts` — portable contract definitions, rewards, instance state, progress inputs/results
- `lib/grid/core/contracts.ts` — validation, activation, expiration, deterministic progress, completion reward intents
- `tests/grid-contract-core.test.ts` — core behavior and safety coverage
- contract design spec documenting boundaries and remote-first rules

## Acceptance gates

- malformed definitions are rejected
- objective progress is integer-safe, monotonic, and capped
- every objective is required for base completion
- location enhancement cannot gate base completion
- expiration wins over late progress
- completion returns reward intents instead of mutating resource state
- input instances remain unchanged
- focused tests, TypeScript, lint, and diff checks pass

## Next recommended milestone

Add a server-authoritative Contract Service that maps trusted Grid game events to objective progress, persists instances, and grants completion rewards transactionally/idempotently through existing resource/event-ledger boundaries.