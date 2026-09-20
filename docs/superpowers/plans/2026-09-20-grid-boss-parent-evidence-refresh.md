# Boss parent evidence refresh

## Problem
Browser-runtime and migration-safety verification were being requested from the sandboxed Codex supervisor. The browser harness can require local process capabilities that are unreliable inside that sandbox, so valid release evidence could fail even when the parent Builder runner could execute it safely.

## Fix
- Refresh required browser-runtime and migration-safety evidence in the parent Builder runner before starting the supervisor.
- Use the preferred local Node toolchain for those parent-owned verification commands.
- Skip refresh when a PASS record already matches the current canonical integration commit.
- Require fresh PASS evidence for the current canonical commit before the cycle can be marked finished.
- Tell the supervisor to read evidence only; it must not rerun the parent-owned recorders from inside the sandbox.

## Safety
The evidence commands remain local-only. They do not deploy, access production URLs, or mutate production databases. The cycle fails closed if required evidence cannot be refreshed to PASS.
