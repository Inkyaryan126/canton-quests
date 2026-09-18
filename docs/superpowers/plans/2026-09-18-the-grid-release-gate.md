# The Grid Release Gate

## Goal

Replace ad-hoc release checking with one repeatable command that refuses to bless an unreconciled workspace and then verifies the canonical Grid integration from coordination state through production compilation.

## Commands

Run the complete gate with: npm run grid:release-gate

For constrained local verification where the production build will run elsewhere: npm run grid:release-gate -- --skip-build

Inspect the exact gate without running checks: npm run grid:release-gate -- --plan

## Gate order

1. Require a clean Git worktree.
2. Run Control Tower preflight.
3. Run Grid launch diagnostics.
4. Run integration journey, security, and deterministic season simulation tests.
5. Run TypeScript.
6. Run Next.js lint.
7. Run Git diff checks.
8. Run the production Next.js build.
9. Confirm the worktree remained clean.

The expensive production build runs last so cheap coordination or correctness failures stop the gate early.
