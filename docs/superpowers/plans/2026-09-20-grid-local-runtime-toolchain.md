# Grid local runtime toolchain

## Problem
Runtime verification inherited `process.execPath` from the automation shell. On this Mac that is `/usr/local/bin/node` v22.2.0, while the working Grid Next server uses the newer NVM Node v24.19.0. Browser verification stalled before Next opened its generated workspace.

## Fix
- Extract the existing newest-NVM-first binary selection into `lib/grid/ops/local-toolchain.ts`.
- Keep Builder OS CLI selection behavior and overrides intact through the shared resolver.
- Add `resolvePreferredLocalNodeBinary`, honoring `GRID_RUNTIME_NODE_BIN`, then newest NVM Node, then PATH/current Node fallbacks.
- Use the preferred local Node for browser-runtime, player-entry-runtime, and map-runtime Next processes.
- Give player-entry cold Next compilation a 90-second startup budget and 60-second destination fetch budget.
- Replace map-runtime's unbounded readiness fetches with abortable probes, a real 90-second startup deadline, and bounded case reads.
- Reconcile the stale map-runtime test with the already-integrated compiled-package fallback while preserving 503 read-failure coverage.
- Keep all runtime verification local-only with remote Supabase credentials cleared.

## Verification
Focused runtime and Builder OS tests must prove NVM preference and that no harness launches Next through `process.execPath`.
