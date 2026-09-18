# Grid Location Enhancement Claim Service

## Goal

Move the remote-first location enhancement policy across a race-safe server persistence boundary without storing raw player coordinates.

## Claim flow

1. Reconcile the server-generated idempotency key first.
2. Read authoritative prior claims for the configured rule.
3. Evaluate the privacy-safe zone attestation through Core.
4. If eligible, call one atomic database function with the approved benefit and rule limit.
5. The database serializes location claims for that player and season, rechecks idempotency, rechecks the per-rule cap, and appends exactly one immutable grant row.

## Privacy boundary

The ledger stores only season, player, rule id, verification id, approved benefit, idempotency key, and timestamps. Latitude, longitude, coordinate arrays, and GPS accuracy are intentionally absent.

## Authority boundary

Authenticated/browser roles receive no table write access and cannot execute the claim RPC. Only the service role can execute the persistence function. A future authenticated route must derive player and season identity server-side and call this service after a trusted presence verifier issues the coarse zone attestation.

## Benefit execution

This phase records the approved grant atomically but does not directly mutate every possible benefit target. Resource settlement, temporary modifiers, optional event access, and crossover reward executors can consume this grant ledger in dedicated server-authoritative lanes.
