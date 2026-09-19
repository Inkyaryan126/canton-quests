# Grid Definition Done Gate Spec

`evaluateDefinitionDoneGate` returns one of `NOT_READY`, `WORKER_READY`,
`INTEGRATION_READY`, or `INTEGRATED`.

`NOT_READY` blockers are ordered as: out of scope, dirty worktree, missing
verification, failed verification, branch not pushed, and inactive/unreleased
claim state. Integration ancestry takes precedence over worker/integration
readiness. `scripts/grid-definition-done-gate.ts` requires `--branch`, accepts
`--lane`, `--integration-ref`, and `--json`, and performs no writes.
