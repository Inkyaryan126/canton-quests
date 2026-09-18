# The Grid Operations Consolidation — Architecture & Design Spec

**Date:** 2026-09-18  
**Author:** Agy / Antigravity CLI  
**Lane:** `ops-consolidation`  
**Status:** Approved for Implementation  
**Scope:** Fast default Grid Master Board, explicit deep mode, 6-state distinction, live watch command, workspace hygiene reporting, guarded safe cleanup, and test coverage.

---

## 1. Problem Statement

As multi-agent parallel development on The Grid scales up, two tools coordinate development state:
1. **Grid Agent Control Tower** (`npm run grid:agents`): short-lived active ownership (claims, worktrees, locks).
2. **Grid Master Board** (`npm run grid:board`): observational development visibility across Git evidence, Boardroom tasks, and milestone catalog.

However, three operational friction points have emerged:
1. **Performance degradation with dormant worktrees**: With 80+ worktrees and 100+ branches, `npm run grid:board` runs hundreds of synchronous sequential Git processes (repeated `git status` and `git log`), taking ~35 seconds per invocation.
2. **Ambiguous development states**: Operators cannot instantly tell the difference between:
   - work already integrated into the active integration branch (`grid-integration-*`),
   - completed work sitting on a clean side branch ready to integrate,
   - active work actively claimed by an agent,
   - dirty dormant work left abandoned without a claim,
   - tasks blocked or rejected by Boardroom, and
   - safe next work with all prerequisites met, ready to be claimed immediately.
3. **Workspace sprawl without safe hygiene**: Over 80 worktrees accumulate in `/tmp` / `/private/tmp`. Operators lack a safe tool to audit workspace hygiene and prune obsolete merged worktrees without risking data loss (dirty files, unmerged branches, or active agent claims).

---

## 2. Core Directives & Invariants

1. **Git is Durable Truth**: Completed work belongs in Git commits. Claims are live coordination traffic control.
2. **Preserve Boardroom Semantics**: Boardroom task ledger, write lock, and handoffs remain authoritative for supervised runs.
3. **Zero Data Loss Guarantee**: Never delete branches. Never delete, discard, or overwrite dirty or unmerged work.
4. **Fast by Default**: `npm run grid:board` must return in under 1 second during typical operations despite 80+ dormant worktrees.
5. **Explicit Deep Mode**: `--deep` performs full historical scanning across all branches and dormant worktrees.
6. **Strict Refusal for Cleanup**: Safe cleanup refuses to prune any worktree that is dirty, unmerged, claimed, running active processes, or the current/primary working tree.

---

## 3. The 6 Canonical Development States

Every milestone and workspace unit is classified into one of six distinct states:

| State | Status Token | Definition & Criteria | Promotion Level |
| :--- | :--- | :--- | :--- |
| **Integrated / Completed** | `INTEGRATED` | Completion commit signals are ancestors of the active integration ref or `main`. | `GRID_INTEGRATION` / `LOCAL_MAIN` / `ORIGIN_MAIN` |
| **Completed (Not Integrated)** | `READY_TO_INTEGRATE` | Completion commit signals exist on a clean branch, not owned by an active claim, not yet merged to integration ref. | `SIDE_BRANCH_ONLY` |
| **Active Claimed** | `IN_PROGRESS` | Owned by an active, non-stale Control Tower claim in `.git/grid-agent-control/claims/*.json`. | `SIDE_BRANCH_ONLY` |
| **Dirty Dormant** | `DIRTY_DORMANT` | Worktree or branch has uncommitted changes or dirty completion commits without an active non-stale claim. | `SIDE_BRANCH_ONLY` |
| **Boardroom Blocked / Rejected** | `BLOCKED` / `REJECTED` | Mapped to a Boardroom task marked `BLOCKED` or `REJECTED`, or blocked by an unmet blocked prerequisite. | `DEPLOYMENT_UNKNOWN` |
| **Safe Next Work** | `SAFE_NEXT_WORK` | Milestone is planned (no active claim, no dirty work, not blocked/rejected) and **all prerequisites in `dependsOn` are `INTEGRATED`**. | `DEPLOYMENT_UNKNOWN` |

---

## 4. Performance & Scaling Architecture

### 4.1 Root Cause of Slowness
- `listWorktreeStates()` ran `git status --short`, `git log -1 --pretty=%s`, and `git log -1 --format=%cI` sequentially inside every worktree directory (80 × 3 = 240 processes).
- `milestoneEvidence()` scanned every branch in `allBranches` (116 branches) and ran `isAncestor` multiple times even for milestones already proven `INTEGRATED` on the integration line.

### 4.2 Optimizations (Fast Default Mode)
1. **Single-pass Batch HEAD Logging**:
   - `git worktree list --porcelain` yields all worktree paths, HEAD hashes, and branch names in 1 call (~10ms).
   - `git log --no-walk --format=%H%x09%cI%x09%s <head1> <head2> ...` resolves commit timestamps and subjects for all unique HEADs in a single process (~30ms) instead of 160 calls.
2. **Targeted Worktree Status in Fast Mode**:
   - In fast mode, `git status --short` is run only on worktrees that are:
     - actively claimed,
     - running active processes,
     - current working directory, or
     - candidates for unintegrated milestones.
   - Dormant, unclaimed, process-free worktrees are marked as dormant without triggering slow disk status walks.
3. **Short-Circuit for Integrated Milestones**:
   - Once a milestone matches the commit log of `integrationRef`, it is definitively `INTEGRATED`. Branch traversal and ancestor checks are skipped.
4. **Ancestor Result Caching**:
   - `isAncestor(cwd, commit, ref)` results are cached in a `Map<string, boolean>` to prevent redundant Git invocations.

### 4.3 Deep Mode (`--deep`)
- When `--deep` is passed:
  - All worktrees are fully status-checked (detecting any uncommitted modifications in dormant worktrees).
  - All local and remote branches are evaluated for milestone completion evidence.
  - Full dormant worktree cleanliness inventory is reported.

---

## 5. Live Watch Mode (`--watch` / `npm run grid:watch`)

- Provides operators with a responsive dashboard refreshing on a configurable interval (default: 3 seconds).
- Displays:
  - Header with integration ref, live claims, stale claims, Boardroom autonomous status.
  - Active claimed lanes with owner, branch, worktree, and real-time heartbeat age.
  - Safe Next Work candidates ready for immediate agent dispatch.
  - Ready to Integrate candidates awaiting merge/reconciliation.
  - Dirty dormant warnings or coordination alerts.
- Graceful exit on `Ctrl+C` (SIGINT/SIGTERM) with cursor restoration.

---

## 6. Workspace Hygiene & Guarded Safe Cleanup

### 6.1 Hygiene Reporting (`npm run grid:agents -- hygiene` / `grid:board --hygiene`)
Categorizes every worktree in the repository:
- `ACTIVE_CLAIMED`: Has active Control Tower claim.
- `ACTIVE_PROCESS`: Has background process running.
- `DIRTY_DORMANT`: Has uncommitted changes without an active claim.
- `UNMERGED_DORMANT`: Clean, but HEAD commit is NOT merged into integration ref.
- `CURRENT_OR_PRIMARY`: The primary repository worktree or current agent worktree.
- `SAFE_TO_PRUNE`: Meets all 6 safety criteria:
  1. Clean (`dirtyPaths.length === 0`).
  2. Fully merged into `integrationRef` or `main` (`isAncestor(head, integrationRef) === true`).
  3. No active or stale claim.
  4. No running processes (`activeProcessCount === 0`).
  5. Not primary worktree.
  6. Not current execution worktree.

### 6.2 Guarded Safe Cleanup (`npm run grid:agents -- prune`)
- **Dry-run by default**: Without `--execute`, lists candidate worktrees and explicitly details why every other worktree is retained.
- **Explicit Execution Flag**: Requires `--execute` to perform any deletion.
- **Safety Invariant**:
  - Refuses dirty worktrees with explicit error: `REFUSED: worktree has uncommitted changes`.
  - Refuses unmerged worktrees: `REFUSED: HEAD commit is not merged into integration ref`.
  - Refuses claimed worktrees: `REFUSED: worktree has active claim`.
  - Refuses active process worktrees: `REFUSED: worktree has active processes running`.
  - **NEVER deletes Git branches** (`git branch -D` is never invoked). Only the temporary worktree directory is pruned with `git worktree remove`.

---

## 7. Everyday Operator Commands Reference

```bash
# Everyday Status & Preflight
npm run grid:board                 # Fast (<1s) development board showing 6 states
npm run grid:board -- --deep        # Exhaustive historical scan & full dormant audit
npm run grid:board -- --json        # Machine-readable JSON output
npm run grid:board -- --snapshot    # Write snapshot to .git/grid-agent-control/

# Live Operator Watch
npm run grid:watch                 # Live auto-refreshing operator dashboard (3s interval)
npm run grid:board -- --watch       # Same as above with custom flags e.g. --interval 5

# Control Tower Live Traffic
npm run grid:agents -- status       # Multi-agent worktree and claim status
npm run grid:agents -- check        # Preflight gate (must exit 0 before new lane)
npm run grid:agents -- claim ...    # Claim lane with exact scope and worktree
npm run grid:agents -- heartbeat    # Heartbeat active lane
npm run grid:agents -- release      # Release lane claim

# Workspace Hygiene & Safe Cleanup
npm run grid:agents -- hygiene      # Inspect workspace health & worktree classifications
npm run grid:agents -- prune        # Dry-run audit of safe-to-prune worktrees
npm run grid:agents -- prune --execute # Prune ONLY clean, merged, unclaimed worktrees
```
