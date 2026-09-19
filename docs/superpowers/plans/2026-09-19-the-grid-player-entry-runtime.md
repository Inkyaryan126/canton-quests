# The Grid Player Entry Runtime Verification

**Date:** 2026-09-19

## Problem
The playable-loop score could only prove that `app/grid/play/route.ts` existed. It therefore held the highest-weight entry stage at YELLOW even though source-contract tests were green. File presence is not proof that the route boots under Next or sends players to reachable safe destinations.

## Checkpoint
Add an operations-only runtime verifier that starts an isolated local Next dev process with all Supabase credentials blanked so it cannot inherit a production database target. It verifies two real HTTP entry cases:

- staged Grid (`GRID_WORLD_READ_ENABLED=0`) redirects `/grid/play` to public `/grid`, which resolves 200;
- enabled Grid with no player session redirects `/grid/play` to `/login?next=%2Fgrid%2Fplay`, which resolves 200.

The verifier uses an ephemeral localhost port, follows no redirect until the destination is validated as same-origin and exact, then shuts the local server down. It performs no authenticated writes and no production mutations.

## Score integration
`collectPlayableLoopScore` accepts explicit runtime evidence. `grid:score-playable-loop -- --verify-entry-runtime` executes the runtime check first and may upgrade the entry stage to GREEN only after that real check succeeds. Ordinary score collection remains side-effect free and continues to report YELLOW when runtime evidence is absent.

## Commands
- `npm run grid:verify-entry-runtime`
- `npm run grid:score-playable-loop -- --verify-entry-runtime --integration-ref <ref>`
