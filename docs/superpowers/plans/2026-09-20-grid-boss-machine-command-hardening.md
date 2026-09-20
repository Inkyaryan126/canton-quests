# Boss Machine command hardening

## Problem
The sandboxed supervisor was wasting each cycle guessing nonexistent npm aliases and running the live crew-health probe, which writes shared Builder OS health files and can fail with EPERM inside the sandbox.

## Fix
- Pin the exact read-only Control Tower, Master Board, Product Director, Playable Loop, prioritizer, and Builder snapshot commands in the supervisor contract.
- Require Definition-of-Done only after a named worker branch exists.
- Point merge work at the direct merge-conveyor script instead of guessed aliases.
- Explicitly forbid the live grid-builder-os-health writer inside the supervisor sandbox; the Boss Panel owns live health refresh.
- Continue using cached crew-health evidence from the Builder snapshot.

## Outcome
Each build cycle starts from deterministic control-plane commands, spends less time rediscovering repo tooling, and avoids shared-state permission failures unrelated to actual Grid development.
