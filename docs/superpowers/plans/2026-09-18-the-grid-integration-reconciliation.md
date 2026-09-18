# The Grid integration reconciliation plan

1. Read the repository vision, Grid architecture, safety rules, and Control
   Tower state; claim only verification scripts, integration tests, simulation
   tests, and this plan/spec.
2. Establish a clean baseline with the lane tests, then restore locked local
   dependencies if the isolated worktree has no install.
3. Extend `grid-integration-verify.ts` with deterministic probes for the
   available onboarding/return, progression, communications, scrimmage, and
   world/City Board contracts. Detect absent Passport, alliance, attestation,
   and world-revision modules as explicit not-integrated evidence.
4. Keep `grid-launch-verify.ts` as the human/JSON dashboard and feed it the
   expanded results without changing the readiness rule: any real regression
   blocks readiness; active lanes and absent contracts remain visible.
5. Expand the journey, security, and small-season tests with ranking, chat,
   scrimmage, ordering, conservation, and replay assertions.
6. Verify targeted tests, typecheck, diff whitespace, and practical lint/build
   checks. Review the diff for scope, commit only declared files, push the lane,
   then release the claim and report evidence plus known gaps.

## Exit criteria

- No active feature implementation files are changed.
- Targeted integration/simulation tests pass.
- `npx tsc --noEmit` and `git diff --check` pass.
- Launch JSON identifies both verified contracts and intentionally absent
  contracts without fake success.
