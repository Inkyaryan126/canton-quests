# Active Contest Discovery — Coordination Lane

**Branch:** `grid-active-contests-20260916`
**Worktree:** `/private/tmp/grid-active-contests`
**Owner:** this ChatGPT stream
**Started:** 2026-09-16 ~04:32 ET

## Scope owned here
Read-only discovery of currently active Grid contest sessions: query contract, service validation/sorting, Supabase adapter, and a read-only API route.

## Files reserved by this lane
- `lib/grid/server/active-contest-port.ts`
- `lib/grid/server/active-contest-service.ts`
- `lib/grid/server/supabase-active-contests.ts`
- `app/api/grid/contests/active/route.ts`
- `tests/grid-active-contests*.test.ts`

## Explicitly NOT owned here
Do not modify contest start/withdraw/round mutation code, participant replay/history, attack/auto-retreat, offline defense, takeover damage, progression, roads, or Grid homepage/public-progress work.

## Current checkpoint
Implementation complete in this lane: service + Supabase adapter + authenticated GET API + focused contract coverage. No schema migration was added; this lane reads the existing indexed `grid_contests` table only.

Verification: 43 focused Grid contest tests pass; `npm run build` completed successfully. Ready for review/merge without touching neighboring mutation/history/defense/progression/roads lanes.
