# The Grid Anti-Cheat Review Persistence Plan

**Owner:** codex-anti-cheat
**Branch:** `grid-anti-cheat-review-20260918`

## Task 1 — Private durable schema

Add append-only assessment, signal, and review audit tables with city/season/player scope, immutable triggers, RLS, service-role-only grants, and additive foreign keys. Use a transactional RPC for assessment plus evidence persistence.

## Task 2 — Server boundary

Add a storage port, validating service, and Supabase service-role adapter. Validate deterministic ordered evidence at the boundary, preserve the core assessment, and expose only internal queue/review operations.

## Task 3 — Replay and review safety

Use a city/season-scoped stable assessment key. Exact replays return the stored assessment without new rows; conflicting scope, assessment, or evidence fails closed. Review state is append-only audit data and cannot alter player/account state.

## Task 4 — Verification

Run only focused anti-cheat tests, `./node_modules/.bin/tsc --noEmit`, and `git diff --check`. Do not run the whole test suite or production migrations.

## Explicit exclusions

No public API, UI, automatic ban/suspension/confiscation/reputation penalty, account mutation, core anti-cheat changes, production deployment, or unrelated files.
