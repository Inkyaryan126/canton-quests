# Canonical Grid V1 Completion Board — Design

## Purpose
The existing Master Board answers whether large engineering milestones were merged. It does not prove the game is complete. The V1 Completion Board is the canonical answer to “what remains?”

## Unit of completion
A board row is one player, gameplay, economy, social, world, season, platform, operations, or launch feature. Every row declares canonical code paths, focused test paths, dependencies, runtime evidence requirements where material, worker scope hints, and acceptance criteria.

## Status rules
`COMPLETE` means all declared code/test artifacts exist on canonical and required runtime evidence is current and passing. `IN_PROGRESS` comes from a live non-stale Control Tower claim. `NEEDS_VERIFICATION` means implementation/test artifacts exist but required runtime evidence is missing, stale, or failing. `PARTIAL` and `MISSING` expose artifact gaps. A feature whose own evidence is complete but whose dependencies are not complete is `BLOCKED`.

## Workflow authority
Product Director consumes incomplete V1 rows first. The Boss scheduler consumes Product Director recommendations, then direct Completion Board remainder, then the older Master Board only for integration cleanup. A 100% milestone-merge count never means Grid V1 is complete.

## Safety
Collection is read-only. It reads Git trees, Control Tower claims, and shared local verification evidence. It never deploys, writes production state, edits claims, or fabricates geography/game mechanics.
