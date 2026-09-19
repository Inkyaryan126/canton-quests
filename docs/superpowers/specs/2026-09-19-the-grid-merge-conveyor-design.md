# The Grid guarded merge conveyor

The merge conveyor is an orchestrator-facing, local Git operation for promoting
one explicitly named, already-released agent branch into the dedicated Grid
integration line. It is a safety gate, not a branch scavenger: the hourly
orchestrator must call it only after it has independently verified that the
agent is done and released the agent claim.

## Safety contract

- Planning is the default. `--execute` is required for mutation, and
  `--branch` is always required.
- The target is the newest local `grid-integration-YYYYMMDD` branch unless
  `--integration-ref` names one explicitly. The target must have its own
  worktree; `main` and arbitrary branches are refused.
- Missing/identical/already-merged branches, active source claims, dirty source
  or target worktrees, and changed paths overlapping another active claim are
  refused.
- `git merge-tree --write-tree` preflights conflicts before an execute.
- Execute uses `git merge --no-ff --no-commit`; focused changed tests,
  optional `--verify` commands, and both working-tree/index whitespace checks
  run before the merge commit. A failed check invokes `git merge --abort`.
- `--push` pushes only the integration branch. `--retire-source` first tags the
  source tip as `grid-archive/<branch>/<timestamp>`, then removes only the
  clean source worktree and local branch. It never deletes or pushes deletion
  of a remote source branch.

## Machine interface

```sh
node ./node_modules/vite-node/vite-node.mjs scripts/grid-merge-conveyor.ts \
  --branch grid-feature-20260919 \
  --integration-ref grid-integration-20260919 \
  --verify './node_modules/.bin/tsc --noEmit'

node ./node_modules/vite-node/vite-node.mjs scripts/grid-merge-conveyor.ts \
  --branch grid-feature-20260919 --execute --push --retire-source
```

Stdout is the JSON plan/result. Refusals are JSON on stderr with a non-zero
exit status. The command never runs the full repository test suite.
