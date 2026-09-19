# Grid Visitor Economy Policy Resolver

## Goal

Provide a server-authoritative resolver for explicitly configured multi-city visitor policy without adding any hidden defaults or inventing Canton tuning.

## Rules

- Resolve the target city from `grid_cities.slug`.
- Consider only playable seasons (`active` or `surge`).
- Zero playable seasons means no active visitor policy and returns `null`.
- More than one playable season is ambiguous and fails closed.
- Read policy only from `season.config.visitorEconomy`.
- Missing policy returns `null`; it never creates default caps.
- All four policy fields must be explicit. `residencyThresholdPoints` may explicitly be `null`.
- Existing Core validation remains authoritative for safe integers, non-negative caps, and positive residency thresholds.

## Deliberately not configured

This resolver does not add `visitorEconomy` values to Canton Founding Season or any other city package. Those balance values remain a product decision.
