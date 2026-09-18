# Grid City #002 Portability Acceptance

## Goal

Prove the existing Grid compiler, Core package validation, and world projection can accept a second city without changing Core or introducing Canton-specific branches.

## Acceptance boundary

This is an architecture gate, not a launch of City #002. The test city is intentionally synthetic and is not added to the production city registry or database.

The acceptance test must prove:

- a non-Canton city identity and season compile through the existing compiler;
- the compiled package passes the existing Core validator;
- the existing world projection renders the second package as neutral/read-only state;
- deterministic compilation remains stable for City #002;
- City #002 and City #001 inputs produce independent checksums;
- `lib/grid/core`, `lib/grid/server`, and `lib/grid/sim` remain free of Canton names, Canton slug constants, and Canton center coordinates.

No visitor caps, residency thresholds, Passport scoring values, production migrations, or new city registry entries are introduced here.
