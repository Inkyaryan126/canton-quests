# Grid Takeover Persistence

## Goal

Close the gap between terminal multi-round territory capture and persistent property ownership.

## Implementation

1. Extend optional season economy configuration with the existing takeover-damage policy shape.
2. Validate all takeover basis-point values as integers in `0..10000`.
3. Give Canton an explicit neutral launch policy rather than an implicit default.
4. Add an atomic territory-owner transition trigger that transfers defeated-owner properties, applies configured damage, resets acquisition time, cancels stale fixed-price listings, and appends immutable audit evidence.
5. Backfill the Canton Founding Season database config only when no explicit takeover policy exists.
6. Verify static contracts, type/lint, and a local PostgreSQL transaction exercising transfer, third-party preservation, cooldown timestamp, listing cancellation, damage arithmetic, and audit event creation.

## Safety

No production migration is applied by this work. The migration remains committed code until the normal deployment gate promotes it.
