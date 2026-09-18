# The Grid Master Board V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a read-only `npm run grid:board` command that derives a Grid-wide development board from Control Tower claims, Git evidence, Boardroom state, and a stable milestone catalog.

**Architecture:** New `lib/grid/master-board/` modules own the data model, milestone catalog, pure classification, read-only runtime collection, and rendering. `scripts/grid-master-board.ts` is a thin CLI. V1 does not modify existing Control Tower or Boardroom behavior and writes snapshots only under the Git common coordination directory when explicitly requested.

**Tech Stack:** TypeScript, Node.js filesystem/child_process APIs, Vitest, existing `lib/agent-control.ts` read-only helpers.

**Spec:** `docs/superpowers/specs/2026-09-17-the-grid-master-board-design.md`

## Global Constraints

- V1 is observational only: no claim/task/ref/worktree/database/network mutation.
- Existing `grid:agents` behavior and formats remain unchanged.
- `READY_TO_INTEGRATE` must remain distinct from `INTEGRATED`.
- Runtime facts are derived; the checked-in milestone catalog stores no live status/owner/heartbeat/test values.
- Snapshot output, when requested, is written only under `.git/grid-agent-control/` via the Git common directory.
- No automatic fetch, deploy, Supabase call, or production inference.

---
## File Structure

- `lib/grid/master-board/types.ts` — board evidence, health, milestone, promotion, and output contracts.
- `lib/grid/master-board/milestones.ts` — stable major Grid milestone catalog and match metadata.
- `lib/grid/master-board/classify.ts` — deterministic pure milestone classification.
- `lib/grid/master-board/collect.ts` — read-only claims/Boardroom/Git evidence collection and integration-ref selection.
- `lib/grid/master-board/render.ts` — terminal, JSON, and Markdown renderers plus snapshot serialization.
- `scripts/grid-master-board.ts` — CLI argument parsing, collection, rendering, optional snapshot write.
- `tests/grid-master-board.test.ts` — pure classification, source precedence, and safety behavior.
- `tests/grid-master-board-cli.test.ts` — CLI/render/snapshot contract with isolated fixture repos.
- `package.json` — add only `grid:board`.

### Task 1: Data model, milestone catalog, and pure classifier

**Files:**
- Create: `lib/grid/master-board/types.ts`
- Create: `lib/grid/master-board/milestones.ts`
- Create: `lib/grid/master-board/classify.ts`
- Create: `tests/grid-master-board.test.ts`

**Interfaces:**
- `GridMilestoneDefinition` contains `id`, `title`, `phase`, `dependsOn`, `lanePatterns`, `branchPatterns`, `integrationCommitSignals`, optional `notes`.
- `GridMilestoneEvidence` contains mapped live claims, candidate branches, integration matches, blocker evidence, warnings.
- `classifyMilestone(definition, evidence): GridMilestoneState` returns status, promotion, evidence summary, and warnings.
- [x] **Step 1: Write failing classifier tests**

Add focused tests for: active claim -> `IN_PROGRESS`; stale claim -> not `IN_PROGRESS`; clean completed side branch -> `READY_TO_INTEGRATE`; dirty completed side branch -> not ready; integration ancestry -> `INTEGRATED`; blocked evidence -> `BLOCKED` when no stronger evidence exists; catalog-only -> `PLANNED`; contradictory evidence -> `UNKNOWN`.

- [x] **Step 2: Run the focused tests and confirm RED**

Run: `npx vitest run tests/grid-master-board.test.ts`
Expected: failure because the Master Board modules do not exist yet.

- [x] **Step 3: Implement minimal contracts, catalog, and classifier**

Use explicit string-literal unions for states and promotion levels. Implement pattern matching as deterministic case-insensitive substring/regex-safe matching over already-collected metadata. Encode source precedence in one pure classifier rather than scattering it across collectors/renderers.

- [x] **Step 4: Run focused tests and confirm GREEN**

Run: `npx vitest run tests/grid-master-board.test.ts`
Expected: all classifier tests pass.

- [x] **Step 5: Commit Task 1**

Stage only Task 1 files and commit: `GRID Ops: add Master Board classification core`.

### Task 2: Read-only runtime evidence collector

**Files:**
- Create: `lib/grid/master-board/collect.ts`
- Modify: `tests/grid-master-board.test.ts`

**Interfaces:**
- `collectGridMasterBoard(options?: { cwd?: string; integrationRef?: string; now?: Date }): GridMasterBoard`
- `resolveIntegrationRef(cwd, explicitRef?)` prefers explicit ref, otherwise highest-date local `grid-integration-*` branch, otherwise returns an explicit unknown state instead of guessing.
- [x] **Step 1: Add failing collector tests using fixture evidence**

Test integration-ref selection, live claim mapping, clean/dirty worktree mapping, Boardroom blocked evidence, stale claim warnings, coordination warning propagation, local `main`/`origin/main` promotion checks, and no dependency on exact live claim counts.

- [x] **Step 2: Confirm RED**

Run: `npx vitest run tests/grid-master-board.test.ts`
Expected: collector tests fail because `collect.ts` is missing.

- [x] **Step 3: Implement read-only collection**

Reuse `readClaims`, `listWorktreeStates`, `boardroomSummary`, `coordinationIssues`, and `staleClaim` from `lib/agent-control.ts`. Use only read-only Git commands (`for-each-ref`, `log`, `show-ref`, `merge-base --is-ancestor`, `rev-parse`). Cache repeated commit/ancestry lookups within one invocation. Never shell through `npm run grid:agents` or mutate claims.

- [x] **Step 4: Confirm GREEN**

Run: `npx vitest run tests/grid-master-board.test.ts`
Expected: all classifier and collector tests pass.

- [x] **Step 5: Commit Task 2**

Stage Task 2 files and commit: `GRID Ops: collect Master Board evidence`.

### Task 3: Renderers, CLI, and shared snapshot

**Files:**
- Create: `lib/grid/master-board/render.ts`
- Create: `scripts/grid-master-board.ts`
- Create: `tests/grid-master-board-cli.test.ts`
- Modify: `package.json`

**Interfaces:**
- `renderMasterBoardText(board): string`
- `renderMasterBoardMarkdown(board): string`
- `serializeMasterBoardJson(board): string`
- CLI flags: `--json`, `--markdown`, `--snapshot`, `--integration-ref <ref>`.
- [x] **Step 1: Write failing CLI/render tests**

Use temporary fixture repositories and injected board fixtures. Assert text/JSON/Markdown agree on milestone states, `READY_TO_INTEGRATE` is visibly separate from `INTEGRATED`, `--integration-ref` is honored, and `--snapshot` writes only `master-board.json` / `master-board.md` beneath the Git common `grid-agent-control` directory.

- [x] **Step 2: Confirm RED**

Run: `npx vitest run tests/grid-master-board-cli.test.ts`
Expected: failure because renderer/CLI do not exist.

- [x] **Step 3: Implement renderers and CLI**

Add `grid:board` to `package.json` using the existing vite-node execution pattern. Default output is terminal text. `--json` prints only JSON. `--markdown` prints Markdown. `--snapshot` additionally writes both shared snapshot files and reports their paths to stderr for JSON cleanliness.

- [x] **Step 4: Confirm GREEN**

Run: `npx vitest run tests/grid-master-board.test.ts tests/grid-master-board-cli.test.ts`
Expected: both suites pass.

- [x] **Step 5: Commit Task 3**

Stage Task 3 files and commit: `GRID Ops: add generated Master Board CLI`.

### Task 4: Live smoke verification and branch completion

**Files:**
- No feature files expected beyond corrective edits within the claimed V1 scope.

- [x] **Step 1: Run focused suites**

Run: `npx vitest run tests/grid-master-board.test.ts tests/grid-master-board-cli.test.ts`.

- [x] **Step 2: Run the real read-only board**

Run: `npm run grid:board` and `npm run grid:board -- --json` against the live repository state. Confirm current active claims appear and the integration ref is explicit.

- [x] **Step 3: Prove ordinary execution is read-only**

Capture claim-file hashes, Git refs, worktree statuses, and Boardroom runtime file metadata before/after a normal `grid:board` run and assert they are unchanged. Run `--snapshot` separately and verify its only writes are the two allowed Git-common snapshot files.

- [x] **Step 4: Run repository verification**

Run `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. If a full-repo failure is unrelated, reproduce it against the branch base before classifying it as pre-existing.

- [x] **Step 5: Final commit if verification required corrective edits**

Commit only verified Master Board changes. Leave the worktree clean and release `master-board-v1`.

## Verification Record

Verified on grid-master-board-design-20260917 before integration:

- Focused Master Board suites: 21/21 passing.
- npx tsc --noEmit: passing.
- npm run lint: passing with no warnings or errors.
- npm run build: completed successfully with exit code 0.
- git diff --check: clean after documentation cleanup.
- Normal board execution remained read-only; snapshot mode writes only the two allowed Git-common snapshot files.
- Full repository suite on the feature branch: 2,873 passed, 34 failed, 2 skipped.
- The exact same 12 files / 34 tests failed on untouched base 48ed52b, proving zero additional full-suite failures from the Master Board work.
- Independent read-only Codex review found dependency-block propagation and invalid explicit integration-ref handling gaps; both were fixed with regression tests.
- Completion evidence was hardened to use terminal engineering checkpoints rather than broad status/doc phrases, preventing documentation commits from being mistaken for completed systems.
