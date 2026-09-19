# Grid Task Prioritizer Runbook

The orchestrator can ask for deterministic work recommendations with:

```bash
node ./node_modules/vite-node/vite-node.mjs scripts/grid-prioritize.ts
node ./node_modules/vite-node/vite-node.mjs scripts/grid-prioritize.ts --json --limit 3
node ./node_modules/vite-node/vite-node.mjs scripts/grid-prioritize.ts --integration-ref grid-integration-20260919
```

Text output is operator-readable. JSON is intended for assignment tooling and
contains the same score breakdown, dependency context, unlock list, status,
and explanation. `--limit` defaults to five and must be positive. The
integration ref is optional; when omitted, the existing master-board collector
selects its normal integration ref.

The result is a recommendation, not an authorization to merge. An
orchestrator should preserve the dependency context, assign only the returned
actionable status, and re-collect the board before acting because branches,
claims, and integration evidence can change after this read-only snapshot.
