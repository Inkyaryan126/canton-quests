# Grid Location-Enhanced Play

## Goal

Complete the server-authoritative path from a consented location measurement to an optional, privacy-safe Grid enhancement grant.

## Steps

1. Resolve zones and enhancement rules exclusively from season configuration.
2. Validate server-configured zone geometry and accuracy policy.
3. Verify a one-time player measurement conservatively on the server.
4. Issue a short-lived, signed, player/season-bound coarse-zone attestation.
5. Add an authenticated claim route that accepts no coordinates and re-resolves the rule before using the existing atomic grant persistence.
6. Keep responses private/no-store and keep raw GPS out of Grid Core and the grant ledger.
7. Verify player/season replay isolation, malformed configuration, zone edge behavior, and API trust boundaries.

## Balance

This work does not invent Canton location rewards or zones. Runtime becomes active when an approved `season.config.locationEnhancements` policy is populated.
