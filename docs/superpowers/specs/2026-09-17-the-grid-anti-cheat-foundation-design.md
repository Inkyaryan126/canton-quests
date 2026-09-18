# The Grid Anti-Cheat Foundation Design

**Status:** APPROVED FOR LOCAL IMPLEMENTATION — 2026-09-17

## Goal

Add a deterministic, city-agnostic anti-cheat assessment core that consumes trusted server evidence without duplicating gameplay authorization or exposing fraud telemetry to players.

## Boundary

Existing server services remain authoritative for identity, city/season scope, adjacency, resources, concurrency, idempotency, and state transitions. Anti-cheat observes the results of those checks; it does not replace them.

This phase is pure Core only: no database migration, API, public projection, automated account sanction, or production activation.

## Evidence model

Trusted producers may emit signals for authoritative integrity failures or behavioral patterns. Signal kinds cover session actor mismatch, city/season scope mismatch, idempotency collision, impossible state transition, resource-conservation failure, velocity anomaly, collusion pattern, market-manipulation pattern, and multi-account linkage.

Every signal has a stable ID, severity, confidence in basis points, source, and reason code. Exact duplicate IDs are deduplicated. Reusing one ID for conflicting evidence fails closed.

## Hard versus soft evidence

Hard-integrity kinds are configured by policy and may reject the current command because they originate from authoritative checks. Soft behavioral signals may only move an assessment from allow to monitor or review, even if their aggregate score reaches 10000 bps.

No result in this phase bans, suspends, confiscates, or changes account state.

## Scoring

Severity weights and confidence are integer basis points. Each unique signal contributes `floor(severityWeightBps * confidenceBps / 10000)`. Contributions are summed and capped at 10000.

Policy supplies monitor and review thresholds plus the hard-reject signal kinds. Thresholds and all numeric inputs are validated deterministically.

## Action-integrity helper

`deriveGridActionIntegritySignals` converts server-computed facts into stable hard evidence: session actor match, city scope, season scope, idempotency collision, state-transition validity, and resource-conservation validity.

It never reads client-claimed balances, ownership, dice results, or identity as truth.

## Privacy and safety

Anti-cheat results are internal telemetry. They must never be added to public world projections, return summaries, market listings, or opponent-visible data.

Future persistence should use the immutable event ledger or a private fraud-review store and remain auditable. Human review remains required for account-level sanctions.

## Acceptance

Tests must prove deterministic ordering, duplicate suppression, conflicting-evidence rejection, hard-command rejection, soft-only monitor/review behavior, score capping, invalid-policy rejection, and no mutation of input arrays or signals.
