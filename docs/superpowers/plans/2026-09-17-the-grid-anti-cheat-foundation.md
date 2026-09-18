# The Grid Anti-Cheat Foundation Plan

**Owner:** ChatGPT Sol
**Date:** 2026-09-17
**Branch:** `grid-anti-cheat-foundation-20260917`
**Base:** `grid-integration-20260917`

## Task 1 — Contracts and policy

Create `lib/grid/core/anti-cheat-types.ts` with signal, severity, source, policy, authoritative action-fact, and assessment contracts. Keep all tuning supplied by config and all scores integer basis points.

## Task 2 — Authoritative fact projection

Create `deriveGridActionIntegritySignals` in `lib/grid/core/anti-cheat.ts`. Emit stable signals only when trusted action facts fail. Do not duplicate domain authorization logic.

## Task 3 — Deterministic assessment

Implement policy validation, evidence validation, exact duplicate suppression, conflicting-ID rejection, deterministic sort order, integer weighted scoring, hard-integrity command rejection, and soft-only monitor/review dispositions.

## Task 4 — TDD and verification

Write `tests/grid-anti-cheat-core.test.ts` first and confirm RED before implementation. Finish with focused anti-cheat tests, existing integration-security/event-ledger regressions, TypeScript, lint, city-leak check, and `git diff --check`.

## Explicitly out of scope

No Supabase changes, API routes, UI, public telemetry, device fingerprinting, sanctions, bans, production data, or deployment. Persistence/review tooling is a later lane after this contract is accepted.
