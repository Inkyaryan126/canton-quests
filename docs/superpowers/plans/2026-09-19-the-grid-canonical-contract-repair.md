# The Grid Canonical Shared-Contract Repair

## Problem

Parallel integration of Alliance and City Power commits replaced shared contract fields instead of composing them. Canonical lost the economy write feature flag, the Alliance season-template type, and the Alliance environment declaration. A persistence-port test mock also lagged the completed disband interface.

## Repair

- Keep economy, contest, City Power, and Alliance season-template contracts together.
- Keep economy, contest, world, foundation, and Alliance feature flags together.
- Preserve the Alliance requirement that foundation and Alliance flags both be explicitly enabled.
- Update the Alliance directory test double for the completed disband persistence methods.
- Use safe ProcessEnv casts in tests without changing production semantics.

## Verification

Run focused feature-flag, Alliance API/directory, city-package, economy route, and City Power tests, then full TypeScript and git diff checks.
