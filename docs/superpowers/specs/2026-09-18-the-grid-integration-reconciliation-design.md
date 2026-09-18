# The Grid integration reconciliation design

## Purpose

Keep launch-readiness evidence aligned with the newest public contracts on the
integration base. The verifier is CLI-first, deterministic, local-only, and
must distinguish a real regression from work that is still isolated in another
lane.

## Evidence model

- `PASS` means a public core/service contract executed with concrete assertions.
- `REAL_REGRESSION` means an available contract threw or returned an invalid
  invariant.
- `FEATURE_NOT_INTEGRATED_YET` means the public module is absent from this base;
  the verifier does not invent a substitute implementation.
- `BLOCKED_BY_ACTIVE_WORK` remains a lane/claim fact, not a test failure.
- No probe loads production credentials, mutates Supabase, or treats a fixture
  as proof of a live deployment.

## Coverage

The reconciliation layer covers onboarding and return settlement, public
progression/rank ordering, economy/market math, City Board projection privacy
and action gating, communications normalization and symmetric direct scope,
private scrimmage lifecycle/revisioning, dynamic/world projections, and the
existing contest/surge/NPC checks. Passport, alliance, location attestation,
and realtime world-revision probes report `FEATURE_NOT_INTEGRATED_YET` when
their public contract is not present on the selected base.

The small-season simulation remains seeded and side-effect-free. Its tests
assert solvency, ownership conservation, monotonic event sequencing, stable
replay, auction transfer, contest accounting, and surge timing.

## Security boundaries

Tests use public types and pure/in-memory ports only. Cross-city market
transactions, anonymous world action state, duplicate scrimmage joins, direct
chat self-scopes, malformed chat input, and server-side onboarding resource
checks remain explicit negative assertions.
