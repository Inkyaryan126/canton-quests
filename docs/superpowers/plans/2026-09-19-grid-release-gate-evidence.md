# Grid Release Gate Evidence

## Goal
Make the existing full Grid release gate produce truthful, commit-bound evidence that the release-candidate manifest can consume.

## Rules
- Evidence is coordination bookkeeping only under the Git common directory.
- Never deploy or write to production.
- A recorded PASS must include the production Next.js build.
- `--record --skip-build` is invalid and must fail before verification begins.
- Failed full-gate runs may record FAIL without leaking command output or secrets.
- Evidence is bound to the exact HEAD commit and becomes stale after canonical changes.

## Files
- Add `lib/grid/ops/release-gate-evidence.ts`.
- Update `scripts/grid-release-gate.ts`.
- Update `lib/grid/ops/release-candidate.ts`.
- Add focused evidence tests and extend release-candidate tests.

## Verification
Run focused tests, TypeScript, lint on touched code, and `git diff --check`. Do not run or record a full release gate until current coding claims are reconciled.