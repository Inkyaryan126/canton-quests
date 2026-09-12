# THE GRID — Foundation Acceptance Record

**Date:** 2026-09-12
**Branch:** `boardroom/astra-overnight-20260912-050423-fb2f`
**Status:** ACCEPTED

This record closes out `docs/superpowers/plans/2026-09-11-the-grid-foundation.md`
(GRID 1–7) plus one hardening pass (GRID 8) identified during acceptance
review. It is the gate that authorizes moving on to the next implementation
phase, City Compiler + Canton Geography
(`docs/superpowers/plans/2026-09-12-the-grid-city-compiler-canton-geography.md`).

## Commits accepted

| Commit | Task |
|---|---|
| `4a53ab8` | GRID 1: Foundation flag and architecture record |
| `0674d10` | GRID 2: Core city-package contracts |
| `50a45cc` | GRID 3: Canton City 001 package and registry |
| `5db28f2` | GRID 4: Multi-city PostGIS database foundation |
| `c3fcfb3` | GRID 5: Authoritative event-ledger service |
| `86b50e8` | GRID 6: Deterministic simulation harness |
| `59cc6be` | GRID 7: Hidden Grid foundation route |
| `e0972c1` | GRID 8: Foundation hardening — event idempotency and edge city-consistency |

GRID 7 was recovered from Claude salvage and independently re-verified as part
of this acceptance pass (focused tests, lint, build all re-run green).

## GRID 8 — hardening added during this acceptance pass

Two structural risks flagged during review of the GRID 4 schema were
reproduced live against a from-scratch local `supabase db reset`, then fixed
as a new local-only migration (`supabase/migrations/20260912054500_grid_foundation_hardening.sql`)
rather than by editing the already-committed GRID 4 migration. Documented as
[ADR-056](../../../DECISIONS.md) in `DECISIONS.md`.

1. **`grid_game_events` idempotency with a null `season_id`.** A plain
   `UNIQUE(season_id, idempotency_key)` treats every `NULL season_id` as
   distinct, so two global (season-less) events could reuse the same
   `idempotency_key`. Reproduced: two inserts with `season_id = null` and the
   same key both succeeded before the fix. Fixed by rebuilding the index with
   `NULLS NOT DISTINCT` (PostgreSQL 15+; this project's local stack runs
   PG17.6). Re-tested: the second duplicate-key insert now fails with
   `duplicate key value violates unique constraint`, while a different key and
   normal per-season duplicates behave unchanged.
2. **`grid_territory_edges` cross-city consistency.** Single-column foreign
   keys on `territory_a_id`/`territory_b_id` only proved each territory
   existed somewhere, not that it belonged to the edge's own `city_id`.
   Reproduced: an edge referencing two territories from two different cities
   inserted successfully before the fix. Fixed by adding a composite unique
   key `grid_territories(id, city_id)` and repointing both edge foreign keys
   at `(territory_x_id, city_id) references grid_territories(id, city_id)`.
   Re-tested: the same cross-city insert now fails with a foreign-key
   violation, while a same-city edge still inserts normally.

Both fixes are covered by new contract tests in `tests/grid-schema-contract.test.ts`
(static assertions against the hardening migration's SQL, matching this
repo's existing migration-contract-test convention) in addition to the live
manual verification above.

## Test results

**Focused Grid tests:** 43/43 passing (40 original + 3 new hardening
contract tests), across:
`grid-event-ledger.test.ts`, `grid-simulation.test.ts`, `grid-city-package.test.ts`,
`grid-schema-contract.test.ts`, `grid-city-registry.test.ts`, `grid-feature-flags.test.ts`.

```
Test Files  6 passed (6)
     Tests  43 passed (43)
```

**City package validation** (`validateGridCityPackage` against the draft
Canton package):
```
ok: true
city: canton-oh
status: draft
```
No fake geography is present — `districts`, `territories`, `edges`,
`properties`, and `landmarks` are all intentionally empty arrays pending the
City Compiler phase (see `lib/grid/cities/canton/founding-season.ts`).

**Lint:** `npm run lint` — `✔ No ESLint warnings or errors`.

**Build:** `npm run build` — production build completed successfully,
including the hidden `/grid` route.

**Full repository baseline:** not re-run in this pass. The most recent full
run (prior to this session) was 2329 passed / 30 failed across 11 files, all
in pre-existing, unrelated Founder's Cipher / live-event presentation
assertions (stale prelaunch date assumptions, old UI text, mission-hub and
finale presentation assertions, the opening-video assertion, and the
Frankenstein presentation assertion). This pass touched only `lib/grid/**`,
`supabase/migrations/*grid*`, and `tests/grid-*` files, so the full-suite
baseline is not plausibly affected and was not rerun, per the acceptance
scope in the approved Foundation plan.

## Local Supabase verification

- `npx supabase start` — local Docker stack (`colima` context) healthy;
  all URLs bound to `127.0.0.1`.
- `npx supabase db reset` — applied all 54 migrations from scratch,
  including `20260912052232_grid_foundation.sql` and
  `20260912054500_grid_foundation_hardening.sql`, with no errors.
- **PostGIS schema:** verified live via `pg_extension`/`pg_namespace` rather
  than assumed — `postgis` installs into the `extensions` schema locally,
  matching this project's existing convention for `pgcrypto`/`uuid-ossp` and
  matching the migration's explicit `extensions.geometry(...)` /
  `extensions.geography(...)` type references. No migration change was
  needed on this point; the original assumption was correct.
- **Geometry/geography types resolve:** confirmed all 9 spatial columns
  across `grid_cities`, `grid_districts`, `grid_territories`, `grid_properties`,
  `grid_landmarks` resolve to `geometry`/`geography` UDTs, and all 8 GiST
  spatial indexes exist.
- **RLS enabled:** confirmed `relrowsecurity = true` on all 10 `grid_*`
  tables. No RLS policies exist yet on any of them, which — combined with
  Postgres's RLS default-deny-with-no-policies behavior — means `anon`/
  `authenticated` currently have **no** row-level access path at all; access
  is exclusively through the server-side service-role ports
  (`GridEventLedgerPort`, etc.), matching "server-authoritative" intent.
- **Browser mutation rights:** confirmed `revoke insert, update, delete ...
  from anon, authenticated` applied to all 10 tables. `anon`/`authenticated`
  do retain `SELECT`/`REFERENCES`/`TRIGGER`/`TRUNCATE` grants — this is
  Supabase's schema-wide default privilege grant applied identically to
  every table in this database, including pre-existing production tables
  like `players` (verified: `players` carries the same `TRUNCATE` grant to
  `anon`/`authenticated` today). It is not something GRID's migrations
  introduced, none of these privileges are reachable through PostgREST
  (which never issues `TRUNCATE`), and changing this repo-wide default is
  out of scope for a Grid-isolated hardening pass — noted here rather than
  silently accepted.
- **Append-only event history:** confirmed live — an `UPDATE` against
  `grid_game_events` raises `grid_game_events is append-only; write a
  compensating event instead` via the `grid_game_events_immutable` trigger.
- **No public `SECURITY DEFINER` functions:** confirmed via `pg_proc` —
  `grid_reject_game_event_mutation` has `prosecdef = false`. Also enforced by
  a static contract test.
- **`players(id)` linkage intact:** confirmed 3 live foreign keys
  (`grid_player_profiles`, `grid_player_season_state`, `grid_game_events.actor_player_id`)
  all reference `public.players(id)`, and the existing Canton Quests
  migrations 1–53 applied ahead of the Grid migrations without alteration.
- **No mutation of existing Canton Quests runtime tables:** confirmed by
  inspection — both Grid migrations only `create table`/`alter table` on
  `grid_*` objects; no existing table's schema was altered.

## Architecture boundary scan

`grep -rniE "canton|stark county|ohio" lib/grid/core lib/grid/server lib/grid/sim`
returns zero matches. Canton-specific data exists only below
`lib/grid/cities/canton/`, matching the non-negotiable Core/City-Package
separation rule.

## Production safety confirmation

- No `supabase db push`, `supabase migration up --linked`, or any command
  targeting the linked remote project (`canton-quests`, ref
  `hdavnmvlnfhcaqjqwrwo`) was run. Every command in this pass targeted
  `127.0.0.1:54322` (local Docker Postgres) only.
- No deployment (`vercel`, `git push origin main`) occurred.
- `GRID_FOUNDATION_ENABLED` defaults OFF: `isGridFoundationEnabled` returns
  `false` unless the environment variable is literally `'1'`
  (`lib/grid/server/feature-flags.ts`), and the flag is not set in any
  committed environment file.
- Working tree is clean at the end of this pass (only the intended commits
  above), aside from `supabase/.temp/cli-latest`, a local CLI-cache file
  that predates this session and is left untouched.

## Acceptance conclusion

All eight Foundation acceptance items pass. THE GRID Foundation
(GRID 1–8) is **ACCEPTED**. Work proceeds to City Compiler + Canton
Geography per
`docs/superpowers/plans/2026-09-12-the-grid-city-compiler-canton-geography.md`.
