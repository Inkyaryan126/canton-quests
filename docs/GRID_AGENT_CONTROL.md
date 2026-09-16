# Grid Agent Control Tower

Grid Agent Control is the live coordination layer for manually launched AI coding streams working in parallel on The Grid.

Boardroom remains the durable task ledger, write-scope/commit authority for supervised runs, and handoff/history system. Git remains the durable source of truth for completed work. Grid Agent Control adds the missing short-lived ownership layer: who is working on which lane right now, in which worktree, and over which paths.

## Required preflight for hand-driven parallel agents

Before editing code:

1. Run `npm run grid:agents -- status`.
2. Run `npm run grid:agents -- check`; do not begin a new lane if it exits non-zero.
3. Confirm no existing claim overlaps the intended file scope.
4. Use an isolated worktree/branch instead of the main working tree whenever multiple streams are active.
5. Claim the lane before editing.
6. Heartbeat the claim periodically during long sessions.
7. Release the claim after the work is committed or intentionally abandoned.

Example:

```bash
npm run grid:agents -- claim \
  --lane road-network \
  --owner chatgpt-stream-3 \
  --goal "Build real Canton road routing" \
  --scope "lib/grid/roads/**,lib/grid/cities/canton/roads/**,tests/grid-road-*.test.ts" \
  --worktree /tmp/grid-road-network \
  --branch grid-road-network-20260915

npm run grid:agents -- heartbeat --lane road-network
npm run grid:agents -- release --lane road-network
```

## What `status` reports

- live lane claims and heartbeat age;
- claimed scopes, owner, branch, worktree, and goal;
- every Git worktree, HEAD, dirty paths, last commit, and matching active processes;
- dirty or active worktrees with no claim;
- stale claims;
- whether a Boardroom autonomous run is active;
- Boardroom runtime task counts, active/queued/checkpointed work, and blocked task count.

## Storage model

Claims are intentionally **not committed**. They live under the repository Git common directory:

`.git/grid-agent-control/claims/*.json`

All worktrees share that directory, so a claim made from one worktree is immediately visible from every other worktree without producing merge conflicts.

Durable completion belongs in Git commits and, when applicable, Boardroom tasks/handoffs. The claim registry is only live traffic control.

## Collision behavior

`claim` refuses to create a lane when its declared path scope overlaps another active claim. This check is intentionally conservative. If two streams genuinely need the same path, coordinate them explicitly rather than bypassing the claim.

For timestamped database migrations, claim the **exact migration filename** once chosen. Avoid broad patterns such as `supabase/migrations/*chat*.sql`: two wildcard patterns can technically match the same future filename, so the Control Tower correctly treats them as overlapping.

`npm run grid:agents -- check` is the machine-readable preflight gate. It exits non-zero when Boardroom autonomous mode is active, a dirty worktree has no claim, or a claim is stale. This makes it suitable for agent startup scripts as well as manual use.

Claims older than six hours without a heartbeat are shown as `STALE`; they are never silently deleted. A human/agent should inspect the corresponding worktree before releasing a stale claim.

## Boardroom interaction

Boardroom supervised runs still follow `boardroom/BOARDROOM.md` and its single-repository write lock. Grid Agent Control does not weaken or replace that lock. If `status` reports a Boardroom autonomous run as ACTIVE, hand-driven agents should not edit the main repository.
