# Grid Canton Production Activation Preflight

## Goal

Turn the final production milestone into a deterministic, non-deploying promotion gate instead of an informal checklist.

## Implementation

1. Read the canonical Master Board for an explicit integration ref.
2. Require every non-activation milestone to be integrated.
3. Require zero live claims and zero coordination warnings.
4. Require a clean worktree.
5. Validate the explicit initial-launch feature flag profile.
6. Require a strong server-only location attestation secret without printing it.
7. Report `READY_FOR_RELEASE_GATE` only when all checks pass.
8. Keep `npm run grid:release-gate` as the mandatory final verification command.

## Commands

- Inspect the production activation contract without evaluating the current environment: `npm run grid:production-activation -- --plan`
- Evaluate a chosen integration ref: `npm run grid:production-activation -- --integration-ref <branch>`
- Machine-readable evaluation: add `--json`.

## Safety

This preflight never performs deployment, Vercel mutations, Supabase migrations, or environment changes. Passing it is necessary but not sufficient for production promotion; the existing release gate must still pass afterward.
