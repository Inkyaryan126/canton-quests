# Grid Agent Control Tower

Grid Agent Control is the live coordination layer for manually launched AI coding streams working in parallel on The Grid.

Boardroom remains the durable task ledger, write-scope/commit authority for supervised runs, and handoff/history system. Git remains the durable source of truth for completed work. Grid Agent Control adds the missing short-lived ownership layer: who is working on which lane right now, in which worktree, and over which paths.

### Boardroom bookkeeping ownership

Generated Boardroom coordination artifacts under the Git-common `grid-agent-control/` directory are globally Boardroom-owned bookkeeping. Runtime reports must stay there so autonomous refreshes cannot dirty a tracked worktree file. `boardroom/handoffs/` remains durable bookkeeping, and `boardroom/reports/MORNING_REPORT.md` is only updated by an explicit manual export. Control Tower excludes the known durable bookkeeping paths from DIRTY_UNCLAIMED and DIRTY_OUTSIDE_CLAIM lane-scope warnings. The exclusion is intentionally narrow: unrelated source or gameplay changes in the same worktree still trigger normal coordination warnings.


## Required preflight for hand-driven parallel agents

Before editing code:

1. Run `npm run grid:agents -- status`.
2. Run `npm run grid:agents -- check`; do not begin a new lane if it exits non-zero.
3. Confirm no existing claim overlaps the intended file scope.
4. Use an isolated worktree/branch instead of the main working tree whenever multiple streams are active.
5. Claim the lane before editing.
6. Heartbeat the claim periodically during long sessions.
7. Release the claim after the work is committed or intentionally abandoned.

## Everyday Operator Commands

```bash
# Everyday Status & Preflight
npm run grid:agents -- status          # Fast (<1s) multi-agent worktree and claim status
npm run grid:agents -- status --deep   # Exhaustive status check across all dormant worktrees
npm run grid:agents -- check           # Preflight gate (must exit 0 before starting new work)
npm run grid:board                     # Master Board: 6-state development status across Git & Boardroom
npm run grid:board -- --deep           # Master Board with exhaustive historical branch scan & hygiene
npm run grid:watch                     # Live auto-refreshing operator dashboard (3s interval)

# Lane Claims & Traffic Control
npm run grid:agents -- claim \
  --lane road-network \
  --owner chatgpt-stream-3 \
  --goal "Build real Canton road routing" \
  --scope "lib/grid/roads/**,lib/grid/cities/canton/roads/**,tests/grid-road-*.test.ts" \
  --worktree /tmp/grid-road-network \
  --branch grid-road-network-20260915

npm run grid:agents -- heartbeat --lane road-network
npm run grid:agents -- release --lane road-network

# Workspace Hygiene & Guarded Safe Cleanup
npm run grid:agents -- hygiene         # Audit worktree hygiene categories & safety status
npm run grid:agents -- hygiene --json  # Machine-readable hygiene report
npm run grid:agents -- prune           # Dry-run audit of safe-to-prune worktrees
npm run grid:agents -- prune --execute # Remove ONLY clean, merged, unclaimed, idle worktrees
```

## What `status` reports

- live lane claims and heartbeat age;
- claimed scopes, owner, branch, worktree, and goal;
- every Git worktree, HEAD, dirty paths, last commit, and matching active processes;
- dirty or active worktrees with no claim;
- stale claims;
- whether a Boardroom autonomous run is active;
- Boardroom runtime task counts, active/queued/checkpointed work, rejected tasks, and blocked task count.

By default, `status` is optimized for high concurrency and returns rapidly by checking status only on active, claimed, current, and process-bearing worktrees. Pass `--deep` to force status checks on all dormant worktrees.

## Workspace Hygiene & Guarded Safe Cleanup

As multi-agent parallel development creates isolated temporary worktrees (often 80+ worktrees), `grid:agents` provides strict tools to inspect and safely reclaim disk space without risk of data loss.

### Hygiene Categories

Every worktree is audited and assigned to one of six mutually exclusive categories:
- `ACTIVE_CLAIMED`: Owned by an active, non-stale Control Tower claim.
- `ACTIVE_PROCESS`: Background dev server or test process is currently running.
- `DIRTY_DORMANT`: Contains uncommitted changes without an active claim.
- `UNMERGED_DORMANT`: Clean, but HEAD commit is not merged into the active integration branch or main.
- `CURRENT_OR_PRIMARY`: Current working directory or primary repository working tree.
- `SAFE_TO_PRUNE`: Fully clean, fully merged, unclaimed, no processes, not primary/current.

### Zero Data Loss Invariants for Pruning

`npm run grid:agents -- prune` enforces strict safety invariants:
1. **Dry-Run by Default**: `prune` prints exactly what would be removed and why other worktrees are retained. Deletion requires `--execute`.
2. **Strict Refusal**:
   - Refuses dirty worktrees (`uncommitted changes; dirty work must never be deleted`).
   - Refuses unmerged worktrees (`HEAD commit not merged into integration; unmerged work must never be deleted`).
   - Refuses claimed worktrees (`active claim`).
   - Refuses active process worktrees (`active processes running`).
   - Refuses primary repo root or current working tree.
3. **Never Deletes Git Branches**: `prune` only removes the worktree directory via `git worktree remove`. Local and remote branches are always preserved in Git history.
4. **Pre-Removal Double-Check**: Even with `--execute`, immediately before removal each candidate is re-verified to guarantee no changes were made since the audit.

## Storage model

Claims are intentionally **not committed**. They live under the repository Git common directory:

`.git/grid-agent-control/claims/*.json`

All worktrees share that directory, so a claim made from one worktree is immediately visible from every other worktree without producing merge conflicts.

Durable completion belongs in Git commits and, when applicable, Boardroom tasks/handoffs. The claim registry is only live traffic control.

## Collision behavior

`claim` refuses to create a lane when its declared path scope overlaps another active claim. This check is intentionally conservative. If two streams genuinely need the same path, coordinate them explicitly rather than bypassing the claim.

For timestamped database migrations, claim the **exact migration filename** once chosen. Avoid broad patterns such as `supabase/migrations/*chat*.sql`: two wildcard patterns can technically match the same future filename, so the Control Tower correctly treats them as overlapping.

`npm run grid:agents -- check` is the machine-readable preflight gate. It exits non-zero when Boardroom autonomous mode is active, a dirty worktree has no claim, a dirty path falls outside every declared claim on that worktree, or a claim is stale. This makes it suitable for agent startup scripts as well as manual use.

Claims older than six hours without a heartbeat are shown as `STALE`; they are never silently deleted. A human/agent should inspect the corresponding worktree before releasing a stale claim.

## Boardroom interaction

Boardroom supervised runs still follow `boardroom/BOARDROOM.md` and its single-repository write lock. Grid Agent Control does not weaken or replace that lock. If `status` reports a Boardroom autonomous run as ACTIVE, hand-driven agents should not edit the main repository.
