# Boss Machine Git permission fix

## Problem
The sandboxed Codex supervisor could read the repository and decide what to build, but it could not create Git refs, worktrees, or Control Tower claims because the Git common directory was outside its writable sandbox.

## Fix
- Resolve the repository Git common directory at runtime.
- Add only that Git metadata directory plus /private/tmp to the Codex workspace-write allowlist.
- Do not add the canonical checkout itself as a writable directory.
- Keep the existing prompt rule forbidding canonical checkout edits and production actions.

## Expected result
The supervisor can create worker branches/worktrees and write Control Tower coordination files while canonical source remains protected.
