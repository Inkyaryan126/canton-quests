# The Grid Canton Production Activation Design

## Purpose

Production activation is a promotion decision, not another gameplay feature. The activation preflight must prove that the completed Grid has been reconciled into one integration ref, active development has stopped, and production feature gates are deliberate before the existing release gate is allowed to bless a deployment candidate.

## No-side-effect boundary

`npm run grid:production-activation` does not deploy, update Vercel configuration, apply Supabase migrations, mutate production data, or enable any feature flag. It is read-only except for ordinary process output. Promotion still requires an explicit human-controlled deployment workflow after the release gate passes.

## Milestone gate

Every Master Board milestone except `production-activation` itself must be `INTEGRATED`. A clean side branch, an in-progress lane, or a safe-next milestone is not enough. This prevents activation while Takeover, Location, Archive, or any other required subsystem is still outside the chosen integration ref.

## Coordination gate

Activation requires:

- an explicit integration ref and commit;
- a clean current worktree;
- zero live Grid agent claims; and
- zero Control Tower coordination warnings.

## Player launch flags

The initial player-facing activation profile requires the foundation, world reads, onboarding writes, economy writes, contests, alliances, chat, fixed-price market, direct deals, and auctions to be explicitly enabled with `1`.

Maintenance operations are intentionally different. Progression rebuild and season archive must be explicitly `0` at initial launch so a maintenance/admin action is never accidentally enabled as part of player activation. They can be enabled later for a controlled operation.

## Location secret

The server-side location verification flow requires `GRID_LOCATION_ATTESTATION_SECRET` with at least 32 UTF-8 bytes. The preflight never prints the secret value.

## Final release gate

A clean activation preflight means only `READY_FOR_RELEASE_GATE`. It is not a claim that production has been deployed or that the final build passed. The next mandatory command is `npm run grid:release-gate`, which runs coordination checks, launch diagnostics, integration/security/simulation tests, TypeScript, lint, diff checks, and the production build.
