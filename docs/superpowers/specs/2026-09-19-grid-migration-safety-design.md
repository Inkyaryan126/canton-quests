# The Grid Migration Safety Gate Design

## Purpose

Release prep needs deterministic evidence that pending Supabase migration changes are safe to hand to a human for `supabase db push`, before anyone runs that push. The gate must reduce this to reading Git history and migration file text — the same evidence a careful reviewer would read by hand — and never touch a live database.

## No-side-effect boundary

`npm run grid:migration-safety` never runs `supabase db push`, `supabase migration up --linked`, any remote SQL, any deploy command, or any production write. It only reads `supabase/migrations/` from the working tree and reads Git history for the resolved base ref. The one thing it accepts as a plain string is the base ref name — no ref content is ever executed.

## Base ref resolution

- `--base-ref <ref>` is accepted explicitly and validated to exist before use.
- With no explicit ref, resolution reuses the Control Tower canonical-integration convention: the lexicographically latest local branch matching `grid-canonical-integration-\d{8}`, falling back to `origin/main`, then local `main`.
- If no candidate resolves, the gate fails loudly (`BASE_REF_UNRESOLVED`) instead of silently comparing against nothing. Guessing a base is worse than refusing to run.

## Evidence model

The gate diffs two migration file sets:

- **Base set**: file names and blob hashes read from `git ls-tree <baseRef> -- supabase/migrations` (pure Git object read, no checkout).
- **Working set**: file names and content hashed from the working tree via `git hash-object`, so uncommitted local migrations are included exactly like committed ones.

From the two sets it classifies:

- **Removed** — present at the base ref, absent from the working tree. Always `BLOCKED`: a migration a base ref already carries must never disappear, since Supabase and any reviewer diffing history assumes migration files are append-only.
- **Modified** — present in both sets with a different blob hash. Always `BLOCKED`: editing a migration file that already shipped on the base ref changes what already-applied history claims to have run; it must become a new additive migration instead.
- **Added** — present only in the working tree. Additive by default; downgraded to `REVIEW`/`BLOCKED` only by the naming or destructive-SQL checks below.

## Naming checks

Every working-tree migration file must match `^\d{14}_[a-z0-9_]+\.sql$` (Supabase's own convention already used by every file under `supabase/migrations/`). A non-matching name is `BLOCKED` (`MALFORMED_MIGRATION_FILENAME`) — Supabase's migration runner sorts and dedupes by this literal prefix, so a bad name is a correctness bug, not a style nit.

Two working-tree files sharing an identical 14-digit prefix are `BLOCKED` (`DUPLICATE_TIMESTAMP_PREFIX`): Supabase identifies a migration by that prefix, so a duplicate is ambiguous by construction.

An **added** file whose timestamp prefix sorts below the highest timestamp already present at the base ref is `BLOCKED` (`NONMONOTONIC_TIMESTAMP`). Canton Quests has hit exactly this failure mode before (see `DECISIONS.md` ADR-027, production schema catch-up from out-of-order migration execution); a new migration that would insert itself before already-applied history is a real, previously-realized production risk, not a hypothetical.

## Destructive SQL evidence

The gate does not parse SQL. It applies conservative, case-insensitive text pattern checks to every **added** or **modified-but-not-yet-blocked** migration body, because a full SQL parser is out of scope and a false negative here is worse than a false positive:

- `DROP TABLE`, `DROP COLUMN`, `DROP SCHEMA`, `DROP DATABASE`, `TRUNCATE` → `BLOCKED` (`DESTRUCTIVE_SQL_STRUCTURAL`). Structural loss is irreversible; the gate always routes it to explicit human review rather than guessing that an `IF EXISTS` guard or a precondition `DO` block (the pattern this repo already uses, e.g. `20260901140000_cleanup_dead_teams_and_legacy_prizes.sql`) makes it safe.
- `DELETE FROM ...` / `UPDATE ... SET ...` with no `WHERE` clause on the statement → `BLOCKED` (`DESTRUCTIVE_SQL_UNBOUNDED`): an unbounded mutation over a live table.
- `DELETE FROM ... WHERE ...` / `UPDATE ... SET ... WHERE ...` → `REVIEW` (`DESTRUCTIVE_SQL_PREDICATED`): a predicate exists, but the gate cannot prove it is narrow, so it is surfaced for human judgment rather than silently passed.

These checks are intentionally conservative in both directions described in the task: they never claim a statement is definitely safe, and they never block a migration that contains none of these patterns.

## Status aggregation

- `BLOCKED` if any finding is `BLOCKED`, or the base ref cannot be resolved.
- `REVIEW` if there is no `BLOCKED` finding but at least one `REVIEW` finding.
- `SAFE` if there are no findings at all (including the case of zero migration changes since the base ref).

## Limitations (documented, not hidden)

This is static evidence collection over file names, Git blob hashes, and text pattern matches. It is **not**:

- a SQL parser or a proof that any statement is syntactically valid Postgres;
- a guarantee that a migration will apply cleanly against the real schema (missing dependent objects, lock contention, and RLS interaction are all invisible to this gate);
- a substitute for a local `supabase db reset` dry run before any production push.

`SAFE` means "no evidence of the specific risk classes this gate checks for" — it is necessary, not sufficient, release-prep evidence, exactly like the existing release gate and production-activation preflight it is meant to sit alongside.

## CLI

This lane's write scope does not include `package.json`, so there is intentionally no `npm run grid:migration-safety` alias yet. Invoke it directly:

`node ./node_modules/vite-node/vite-node.mjs scripts/grid-migration-safety.ts [--base-ref <ref>] [--json] [--record]`

It prints the report as text or JSON and never mutates the working tree, Git refs, or `supabase/migrations/`. Exit code is `0` for `SAFE`, `1` for `REVIEW`, `2` for `BLOCKED`, and `1` for any evaluation error (including an unresolved base ref).

`--record` additionally writes a `PASS`/`FAIL` evidence snapshot bound to the current commit, matching the evidence-writer pattern already used by `lib/grid/ops/grid-builder-os.ts`. It writes only to `<git-common-dir>/grid-agent-control/evidence/migration-safety.json` — Boardroom-owned coordination bookkeeping outside any tracked worktree — never to `supabase/migrations/` or any other tracked file. A future lane can add the `npm run grid:migration-safety` script alias and wire this gate (and its `--record` evidence) into `grid-release-gate.ts` alongside the other read-only checks.
