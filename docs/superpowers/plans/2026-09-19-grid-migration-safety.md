# Grid Migration Safety Gate

## Goal

Give Grid release prep deterministic SAFE/REVIEW/BLOCKED evidence about pending Supabase migration changes, purely from Git and file-text evidence, with zero database contact.

## Implementation

1. Resolve a base ref: explicit `--base-ref`, else the latest `grid-canonical-integration-\d{8}` branch, else `origin/main`, else local `main`; fail clearly (`BASE_REF_UNRESOLVED`) if none exist.
2. Read the base-ref migration file set via `git ls-tree` (name + blob hash, no checkout) and the working-tree migration file set via `fs.readdirSync` + `git hash-object`, so uncommitted local migrations are covered.
3. Classify each file as removed, modified, or added relative to the base ref.
4. Always `BLOCKED` on removed or modified-vs-base-ref files — a migration already on the base ref must never disappear or be rewritten in place.
5. Validate the `\d{14}_[a-z0-9_]+\.sql` filename convention and reject duplicate 14-digit prefixes across the working tree.
6. Reject (`BLOCKED`) any added file whose timestamp prefix sorts below the highest timestamp already present at the base ref (out-of-order execution risk, previously realized per `DECISIONS.md` ADR-027).
7. Scan added/added-equivalent migration bodies with conservative, case-insensitive text patterns for `DROP TABLE|COLUMN|SCHEMA|DATABASE`/`TRUNCATE` (`BLOCKED`), unbounded `DELETE`/`UPDATE` with no `WHERE` (`BLOCKED`), and predicated `DELETE`/`UPDATE` (`REVIEW`).
8. Aggregate to one overall status: `BLOCKED` > `REVIEW` > `SAFE`.
9. Ship both a library function (`lib/grid/ops/migration-safety.ts`) and a thin CLI (`scripts/grid-migration-safety.ts`) with `--base-ref`, `--json`, and `--record`.

## Commands

- Evaluate against the default resolved base ref: `node ./node_modules/vite-node/vite-node.mjs scripts/grid-migration-safety.ts`
- Evaluate against an explicit base ref: `node ./node_modules/vite-node/vite-node.mjs scripts/grid-migration-safety.ts --base-ref origin/main`
- Machine-readable evaluation: add `--json`.
- Record a PASS/FAIL evidence snapshot for the current commit, alongside the other Grid ops evidence writers, into git-common bookkeeping (never the tracked worktree): add `--record`. This only writes to `<git-common-dir>/grid-agent-control/evidence/migration-safety.json`; it never touches `supabase/migrations/` or any tracked file.

No `npm run` alias is added in this lane; `package.json` is outside its claimed write scope.

## Tests

`tests/grid-migration-safety.test.ts` builds temporary Git repos with `fs.mkdtempSync` (mirroring `tests/grid-merge-conveyor.test.ts`) and fixture SQL strings to cover: clean additive pass, malformed filename, duplicate prefix, nonmonotonic new timestamp, modified and removed already-shipped migration files, each destructive SQL class, an unresolved base ref, the git-common evidence writer, and text rendering. The CLI (`scripts/grid-migration-safety.ts`) stays a thin wrapper around `evaluateGridMigrationSafety`/`renderMigrationSafetyReportText`/`writeMigrationSafetyEvidence`, so testing those exported library functions is equivalent to testing the CLI's output, matching the `grid-merge-conveyor` convention of not spawning the CLI process in tests. No live Supabase connection is used or required.

## Safety

This gate never runs `supabase db push`, `migration up --linked`, remote SQL, or any deploy command, and it never mutates the working tree, Git refs, or `supabase/migrations/`. A `SAFE` result is necessary, not sufficient, evidence: it is not proof a migration will apply cleanly against the real schema. A local `supabase db reset` dry run remains the mandatory next step before any production push, and `npm run grid:release-gate` remains the mandatory final verification command for release prep.
