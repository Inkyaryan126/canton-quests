# Grid Release Evidence Refresh

## Goal
Restore truthful current-commit release evidence after the Boss Panel checkpoint without enabling production flags, touching remote databases, or overlapping Alliance reconciliation.

## Root causes
- Browser runtime readiness polling could hang on an accepted socket because its fetch had no bounded per-request timeout.
- Evidence collection always waited for an h2 even on routes where no secondary heading is required.
- The browser spec expected PLAYER AUTHENTICATION REQUIRED while the verifier intentionally disables world reads; the canonical contracts client correctly renders CONTRACT SIGNAL STAGED in that environment.
- Browser failed-resource console text did not identify which request failed, so expected staged API 404s could not be distinguished from missing chunks or real network regressions.
- Release-candidate unit tests accidentally consumed live git-common evidence and changed result as the operator evidence changed.

## Checkpoint
- Keep the browser verifier local-only with all Supabase targets blank and world reads disabled.
- Bound startup probes and preserve fail-closed cleanup.
- Validate CONTRACT SIGNAL STAGED and allow only the exact /api/grid/contracts 404 used to produce that state.
- Record HTTP error URL/status evidence and fail on every undeclared error response.
- Make release-candidate tests hermetic with injected evidence or temporary repositories.
- Confirm migration safety by static Git/file analysis only.

## Verification
- Focused browser-runtime, migration-safety, and release-candidate tests.
- Real local Chrome journey at 390x844.
- TypeScript check, lint, and git diff check.
- Commit and push this isolated branch; do not deploy or enable production.
