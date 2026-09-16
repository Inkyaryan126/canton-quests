# THE GRID — Season Economy + Ownership Phase Acceptance

**Date:** 2026-09-15
**Status:** ACCEPTED LOCALLY / NOT PRODUCTION-ACTIVATED

## Accepted scope

Phase 2 now includes season join/resource settlement, neutral territory claims, property acquisition, five development branches, deterministic Skyline projection, deterministic economy simulation, Canton Founding Season tuning, and the read-only player-visible `/grid` world projection.

The `/grid` experience renders the compiled real Canton territory geometry and property layer. When the read feature flag is enabled and matching runtime rows exist, `/api/grid/world` overlays season ownership, player wallet, development state, valid expansion targets, and qualified Skylines.

## Safety boundary

The player-visible projection is read-only. The Grid world API exposes only `GET`; its Supabase adapter contains no insert/update/delete/upsert/RPC path. Rival ownership is projected only as `occupied`, not as rival player IDs. Private property names remain sanitized.

Production economy activation remains separate. No production migration, database push, deployment, or runtime activation was performed as part of this acceptance.

## Verification

- Grid tests: 31 files passed
- Grid assertions: 218 passed, 2 skipped
- Focused world-projection tests: passed
- ESLint: no warnings or errors
- Next.js production build: passed
- `/api/grid/world`: present as a dynamic read endpoint
- `/grid`: production build includes the expanded City Board client
- Core/server city-leak grep (`canton|stark county|ohio`): no matches
- World projection mutation grep: no browser/runtime write methods found

## Phase result

Economy/ownership Phase 2 is complete at the local/code level. The next roadmap phase can build contests, Signal Dice, attacks/defense, auctions, alliances, Surge systems, NPC factions, and later the final 2.5D renderer on top of this accepted projection contract without rewriting the economy foundation.
