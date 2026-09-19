# Grid Merge Conveyor — Canonical Target Support

The guarded merge conveyor originally accepted only targets named
grid-integration-YYYYMMDD.

The live Grid coordination system now uses
grid-canonical-integration-YYYYMMDD as its canonical integration branch, so the
conveyor could plan no legal merge into the branch it was built to protect.

This patch broadens only the dedicated-target name check to accept both:

- grid-integration-YYYYMMDD
- grid-canonical-integration-YYYYMMDD

All other conveyor safeguards remain unchanged:

- explicit source branch required
- source branch must have a dedicated worktree
- source cannot have an active claim
- source and target must both be clean
- active overlapping claim scopes block the merge
- merge-tree conflict preflight must pass
- focused tests and supplied verification run before commit
- any failed verification aborts the no-commit merge
- main and arbitrary branch names remain forbidden

The test suite creates a disposable canonical integration worktree to prove the
new target is accepted and separately proves a lookalike non-dated canonical
name is still refused.
