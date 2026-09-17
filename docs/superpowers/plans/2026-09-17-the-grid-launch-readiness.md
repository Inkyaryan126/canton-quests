# The Grid: Launch Readiness & Verification Layer Plan

**Owner**: Agy (Integration, QA, and Launch Hardening)  
**Date**: 2026-09-17  
**Branch**: `grid-launch-readiness-20260917`  
**Target Base**: `grid-integration-20260917`  
**Status**: IN_PROGRESS  

---

## 1. Goal

Build a reusable, robust, zero-production-risk Grid integration verification layer that proves independently-developed systems coexist harmoniously. Provide automated verification of:
1. End-to-end player journeys across all implemented systems.
2. Hard boundaries: server authority, multi-tenant isolation (city/season), idempotency, stale writes, race handling, and privacy leak protection.
3. Deterministic small-season simulation with synthetic players.
4. A single launch-readiness verification command and reporting engine distinguishing `PASS`, `REAL_REGRESSION`, `KNOWN_PREEXISTING_FAILURE`, `FEATURE_NOT_INTEGRATED_YET`, and `BLOCKED_BY_ACTIVE_WORK`.

---

## 2. Implementation Tasks

### Task 1: Architectural Specification & Claim Registration
- [x] Inspect existing claims, worktrees, and processes via `grid:agents status` and `grid:agents check`.
- [x] Create isolated worktree `/private/tmp/grid-launch-readiness` and branch `grid-launch-readiness-20260917`.
- [x] Register narrow non-overlapping claim for lane `launch-readiness`.
- [x] Write architectural specification `docs/superpowers/specs/2026-09-17-the-grid-launch-readiness-design.md`.
- [x] Write detailed execution plan `docs/superpowers/plans/2026-09-17-the-grid-launch-readiness.md`.

### Task 2: Player Journey Coexistence Test Suite (`tests/grid-integration-journey.test.ts`)
- [ ] Implement integrated in-memory harness simulating connected services:
  - Onboarding & home city selection
  - Season join & starting resources
  - Starter territory claims
  - World projection reflection
  - Economy income & property development
  - Adjacent territory attacks & offline defense
  - Returning player briefing calculation
  - Property auctions & fixed-price market transactions
  - Dynamic events & Surge finale projections
- [ ] Validate cross-system invariant preservation through full multi-phase progression.

### Task 3: Server Authority, Isolation & Concurrency Suite (`tests/grid-integration-security.test.ts`)
- [ ] Server Authority checks:
  - Unauthorized manipulation of dice rolls, wallet balances, or territory ownership rejected.
  - Invalid adjacency or insufficient influence attacks rejected.
- [ ] City & Season Isolation checks:
  - Commands with Season A ID rejected when referencing Season B parcels.
  - Cross-city commands rejected.
- [ ] Idempotency & Double-Submit checks:
  - Replay of join, claim, attack, bid, and purchase requests return identical response without duplicate resource deductions.
- [ ] Stale Writes & Concurrency checks:
  - Concurrent claims on same parcel: only first succeeds, second rejected.
  - Outbid race conditions: second bid must strictly exceed first bid.
- [ ] Privacy Leakage checks:
  - Verify world projection, return summary, and market listings do not expose secrets, internal DB identifiers, anti-fraud flags, or opponents' private policies.

### Task 4: Deterministic Small-Season Simulation (`tests/grid-season-simulation.test.ts`)
- [ ] Build synthetic simulation engine:
  - Seeded Mulberry32 RNG for 100% determinism.
  - Synthetic players with varied cadences (1h, 4h, 12h, 24h) and strategies (aggressive, economic, speculator).
  - Ticked execution covering season phases: early game (claims), mid game (contests & developments & auctions), end game (Surge finale).
  - Full invariant verification: conservation of assets, exclusivity, non-negative wallets, monotonic sequence.
  - Reproducibility test: identical seed yields identical results, differing seed yields distinct results.

### Task 5: Launch-Readiness Diagnostic & Verification CLI (`scripts/grid-launch-verify.ts` and `scripts/grid-integration-verify.ts`)
- [ ] Build standalone runner that executes verification matrix.
- [ ] Dynamically inspects `.git/grid-agent-control/claims` to detect active lanes.
- [ ] Classifies subsystems:
  - `PASS`: All integration criteria satisfied.
  - `REAL_REGRESSION`: Invariant broken on merged base.
  - `KNOWN_PREEXISTING_FAILURE`: Documented non-Grid or external-credential failure.
  - `FEATURE_NOT_INTEGRATED_YET`: Separate branch feature not yet in base.
  - `BLOCKED_BY_ACTIVE_WORK`: Domain locked by another active agent stream.
- [ ] Produces human-readable CLI table and structured JSON summary.

### Task 6: Verification & Hand-off
- [ ] Run new test suites via Vitest.
- [ ] Run full relevant Grid test suites.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build` (or Next.js build verification).
- [ ] Release Grid Agent Control claim cleanly.
- [ ] Commit all work on `grid-launch-readiness-20260917`.
- [ ] Generate comprehensive final hand-off report with exact commit hash and evidence.
