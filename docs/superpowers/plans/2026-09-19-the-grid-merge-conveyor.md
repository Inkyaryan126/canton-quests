# Grid merge conveyor implementation plan

1. Add a Git/worktree/claim preflight that resolves an explicit source and a
   dedicated `grid-integration-*` target, reports changed paths and discoverable
   focused tests, and remains read-only by default.
2. Add guarded no-commit execution with conflict preflight, focused/optional
   verification, rollback on any failure, and commit only after verification.
3. Add optional integration push and safe source retirement with an immutable
   archive tag that preserves the remote source branch.
4. Expose JSON plan/result CLI output and document that the hourly orchestrator
   calls it only after agent completion verification.
5. Prove refusals, dry-run immutability, rollback, verified merge, and
   retirement semantics with disposable Git repositories/worktrees.
