# Boss Machine process probe fix

## Problem
Sandboxed supervisors can receive EPERM from process.kill(pid, 0) when probing a live parent process. Builder OS treated every probe error as a dead process, so a live build cycle could be displayed as needs_attention inside the sandbox.

## Fix
- Treat EPERM as evidence that the process exists but cannot be signaled from the current sandbox.
- Continue treating ESRCH and unknown probe failures as not alive.
- Keep cached crew health advisory inside supervisor decisions; actual live worker launch results are stronger evidence.

## Safety
This changes only local Builder OS liveness interpretation and supervisor guidance. It does not expand production access, mutate gameplay state, or weaken Control Tower claims.
