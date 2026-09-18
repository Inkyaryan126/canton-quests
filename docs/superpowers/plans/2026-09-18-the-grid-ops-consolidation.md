# The Grid Operations Consolidation — Implementation Plan

**Goal:** Turn Grid Master Board + Grid Agent Control Tower into one fast, reliable, operator-friendly workflow for multi-agent development.

**Architecture:**
- Optimize `lib/agent-control.ts` with batch commit resolution and fast vs. deep worktree scanning.
- Add Boardroom rejected task tracking to `BoardroomTaskSummary`.
- Add workspace hygiene evaluation (`auditWorkspaceHygiene`) and guarded safe pruning (`pruneSafeWorktrees`) that strictly refuses dirty, unmerged, claimed, or active worktrees, and never deletes branches.
- Expand `lib/grid/master-board/types.ts` and `classify.ts` with the 6 canonical states: `INTEGRATED`, `READY_TO_INTEGRATE`, `IN_PROGRESS`, `DIRTY_DORMANT`, `BLOCKED`, `REJECTED`, and `SAFE_NEXT_WORK`.
- Optimize `lib/grid/master-board/collect.ts` to be fast by default (<1s) by short-circuiting integrated milestones and caching ancestry checks, with explicit `--deep` mode for full historical scanning.
- Update `lib/grid/master-board/render.ts` to cleanly format the 6 states, hygiene summaries, and warnings.
- Implement live watch mode (`--watch`, `npm run grid:watch`) in `scripts/grid-master-board.ts`.
- Wire `hygiene`, `prune`, and `watch` subcommands into `scripts/grid-agent-control.ts`.
- Update `docs/GRID_AGENT_CONTROL.md` with exact everyday operator commands.
- Add comprehensive tests for scaling/performance, claim accuracy, 6-state distinction, hygiene auditing, and cleanup refusal.

---

## Tasks

### Task 1: Fast Worktree & Hygiene Operations in `lib/agent-control.ts`
- [ ] Add batch commit lookup (`batchCommitHeaders`) using `git log --no-walk`.
- [ ] Update `listWorktreeStates(cwd, options)` with `fast?: boolean; deep?: boolean; targetWorktrees?: string[]`.
- [ ] Parse `REJECTED` tasks in `boardroomSummary()`.
- [ ] Implement `auditWorkspaceHygiene(cwd, options)` returning categorized worktrees.
- [ ] Implement `pruneSafeWorktrees(cwd, options)` requiring `execute: boolean`, refusing dirty/unmerged/claimed/active/primary worktrees, and never deleting branches.

### Task 2: 6-State Master Board Classification & Types
- [ ] Update `lib/grid/master-board/types.ts` with `DIRTY_DORMANT`, `REJECTED`, `SAFE_NEXT_WORK` and hygiene metadata.
- [ ] Update `lib/grid/master-board/classify.ts`:
  - Flag dirty completion branches as `DIRTY_DORMANT`.
  - Distinguish Boardroom `REJECTED` tasks from `BLOCKED`.
  - Identify unblocked, unclaimed planned milestones with met prerequisites as `SAFE_NEXT_WORK`.

### Task 3: Fast Collection & Explicit Deep Mode
- [ ] Update `lib/grid/master-board/collect.ts`:
  - Default fast mode: short-circuit integrated milestones, cache ancestry checks, inspect only relevant worktrees.
  - Deep mode (`--deep`): scan all historical branches, full dormant worktree audit.
  - Integrate Control Tower claim metadata directly.
  - Integrate workspace hygiene summary.

### Task 4: Terminal, Markdown, JSON Renderers & Live Watch
- [ ] Update `lib/grid/master-board/render.ts` to display 6 states with clear groupings (`IN PROGRESS`, `READY TO INTEGRATE`, `SAFE NEXT WORK`, `INTEGRATED`, `DIRTY DORMANT`, `BLOCKED / REJECTED`, `PLANNED`).
- [ ] Add `--deep`, `--watch`, `--interval`, `--hygiene` flags to `scripts/grid-master-board.ts`.
- [ ] Implement watch loop with clean TTY clearing and graceful signal handling.
- [ ] Add `grid:watch` to `package.json`.

### Task 5: Agent Control CLI Enhancements & Everyday Commands
- [ ] Add `hygiene`, `prune`, and `watch` subcommands to `scripts/grid-agent-control.ts`.
- [ ] Update `docs/GRID_AGENT_CONTROL.md` with exact everyday commands.

### Task 6: Comprehensive Test Coverage & Verification
- [ ] Add tests in `tests/grid-agent-control.test.ts` for:
  - Hygiene categorization
  - Pruning refusal on dirty worktree
  - Pruning refusal on unmerged worktree
  - Pruning refusal on claimed worktree
  - Pruning refusal on active processes
  - Preservation of Git branches
- [ ] Add tests in `tests/grid-master-board.test.ts` for:
  - Fast scaling collection (<1s)
  - 6 distinct states (`SAFE_NEXT_WORK`, `DIRTY_DORMANT`, `REJECTED`, etc.)
  - Deep mode vs fast mode
- [ ] Add tests in `tests/grid-master-board-cli.test.ts` for CLI flags (`--deep`, `--watch` single-run, `--hygiene`).
- [ ] Run `npx vitest run`, `npx tsc --noEmit`, `git diff --check`.
