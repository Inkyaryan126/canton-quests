# Boss supervisor proof guard

## Problem
Inside the Codex sandbox, raw shell liveness probes such as `kill -0` can fail with EPERM even while the parent Builder runner is alive. The supervisor then wastes time investigating a false dead-run signal. It also had to rediscover the exact evidence-refresh commands each cycle.

## Fix
- Pin the exact browser-runtime, migration-safety, and release-candidate commands in the supervisor contract.
- Forbid raw `kill -0`, sandbox-local `ps`, and signal-permission failures as parent-runner liveness evidence.
- Trust Builder OS run state, where EPERM is already interpreted correctly.

## Safety
This changes only local orchestration guidance. It does not broaden production access, mutate gameplay state, or weaken Control Tower isolation.

## Acceptance
The supervisor should proceed directly to local evidence refresh when appropriate, without stopping to investigate false sandbox liveness signals.
