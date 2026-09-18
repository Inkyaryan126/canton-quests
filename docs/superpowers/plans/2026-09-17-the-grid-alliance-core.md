# The Grid Alliance Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build deterministic, city-agnostic Alliance membership, pooled Influence, upkeep, and map-network mechanics without persistence/API/UI work.

**Architecture:** Two focused pure-core files hold Alliance contracts and deterministic functions. The implementation consumes caller-supplied state/config and returns decisions/projections; it never reads a clock, database, city package, or network service.

**Tech Stack:** TypeScript 5.x, Vitest 2.x, existing Grid Core conventions.

**Spec:** `docs/superpowers/specs/2026-09-17-the-grid-alliance-core-design.md`

## Global Constraints

- One active Alliance per player per season.
- Leaving blocks every Alliance join until the configured cooldown boundary.
- Personal ownership/resources remain personal except explicit Influence contribution into the bounded pool.
- No pooled Influence withdrawal primitive in this phase.
- All gameplay numbers are non-negative safe integers and config-driven.
- No Canton/Ohio/Stark-specific imports or names in the new core files.
- No Supabase, API, UI, deployment, migration, or production activation work.

---
### Task 1: Membership and cooldown contracts

**Files:**
- Create: `lib/grid/core/alliance-types.ts`
- Create: `lib/grid/core/alliance.ts`
- Create: `tests/grid-alliance-core.test.ts`

**Interfaces:**
- Produces `GridAllianceRules`, `GridAllianceMembership`, `GridAllianceJoinRequest`, and `GridAllianceJoinDecision`.
- Produces `validateGridAllianceRules`, `evaluateGridAllianceJoin`, and `leaveGridAlliance`.

- [ ] **Step 1: Write failing membership tests**

Cover one active membership per season, different-season independence, capacity, cooldown rejection, exact-boundary acceptance, and deterministic leave cooldown.

- [ ] **Step 2: Run the focused suite and verify RED**

Run: `npx vitest run tests/grid-alliance-core.test.ts --reporter=dot`
Expected: FAIL because Alliance core modules do not exist.

- [ ] **Step 3: Implement the minimum membership core**

Validate identifiers/timestamps/rules, return typed gameplay denials, and compute cooldown with safe integer timestamp arithmetic.

- [ ] **Step 4: Run focused suite and verify GREEN**

Run the same Vitest command and require every membership test to pass.

### Task 2: Bounded Influence pool and coordination upkeep

**Files:**
- Modify: `lib/grid/core/alliance-types.ts`
- Modify: `lib/grid/core/alliance.ts`
- Modify: `tests/grid-alliance-core.test.ts`

**Interfaces:**
- Produces `GridAllianceContributionInput/Decision` and `GridAllianceUpkeepProjection/Settlement`.
- Produces `contributeGridAllianceInfluence`, `calculateGridAllianceUpkeep`, and `settleGridAllianceUpkeep`.

- [ ] **Step 1: Add failing pool/upkeep tests**

Prove contribution cannot exceed request, player balance, or pool capacity; prove zero/invalid requests fail closed; prove upkeep includes base/member/fragmentation/large-alliance terms; prove settlement never makes the pool negative.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/grid-alliance-core.test.ts --reporter=dot`
Expected: new pool/upkeep assertions fail because the functions are absent.

- [ ] **Step 3: Implement minimal integer-safe pool/upkeep functions**

Use checked safe-integer add/multiply helpers. Return the accepted transfer amount and constraint reason; expose paid amount and shortfall on upkeep settlement.

- [ ] **Step 4: Verify GREEN**

Run the focused suite and require all membership plus pool/upkeep cases to pass.

### Task 3: Connected Alliance Network projection

**Files:**
- Modify: `lib/grid/core/alliance-types.ts`
- Modify: `lib/grid/core/alliance.ts`
- Modify: `tests/grid-alliance-core.test.ts`

**Interfaces:**
- Produces `GridAllianceTerritoryOwnership`, `GridAllianceAdjacencyEdge`, and `GridAllianceNetworkProjection`.
- Produces `projectGridAllianceNetwork(memberPlayerIds, territoryOwnership, adjacencyEdges)`.

- [ ] **Step 1: Add failing network tests**

Prove same-member and cross-member adjacent territories form components, non-member territory cannot bridge components, isolated territories are reported, duplicate/reordered inputs produce the same sorted projection, and ownership inputs remain unmodified.

- [ ] **Step 2: Verify RED**

Run the focused Alliance suite and confirm the new network tests fail for the missing projection.

- [ ] **Step 3: Implement deterministic graph projection**

Filter ownership to active members, deduplicate territory slugs, traverse only accepted edges whose endpoints are both controlled, sort every component and the component list, and derive largest/isolated/disconnected metrics.

- [ ] **Step 4: Verify GREEN**

Run the focused Alliance suite and require every test to pass.

### Task 4: Regression and architecture gate

**Files:**
- Verify only the five claimed Alliance files changed.

- [ ] **Step 1: Run focused Alliance tests**

`npx vitest run tests/grid-alliance-core.test.ts --reporter=dot`

- [ ] **Step 2: Run nearby Grid core regressions**

`npx vitest run tests/grid-skyline.test.ts tests/grid-territory-control.test.ts tests/grid-economy-contracts.test.ts --reporter=dot`

- [ ] **Step 3: Run static gates**

`npx tsc --noEmit --pretty false`

`npm run lint`

`git diff --check`

`grep -niE 'canton|stark county|ohio' lib/grid/core/alliance.ts lib/grid/core/alliance-types.ts && exit 1 || true`

- [ ] **Step 4: Review scope and commit**

Confirm `git status --short` contains only claimed paths, then commit the completed Alliance core checkpoint with a `GRID Alliance 1:` message.
