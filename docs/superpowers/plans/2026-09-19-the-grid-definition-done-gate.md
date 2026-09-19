# Grid Definition Done Gate Plan

1. Evaluate scope and cleanliness first.
2. Require present, passing verification and a pushed branch.
3. Classify active claimed work as `WORKER_READY`.
4. Classify released, unmerged work as `INTEGRATION_READY`.
5. Classify source commits already ancestral to the dedicated integration ref as `INTEGRATED`.

The CLI is read-only and reports blockers in a stable order.
