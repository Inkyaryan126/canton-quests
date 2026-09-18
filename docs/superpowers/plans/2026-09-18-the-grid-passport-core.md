# Grid Passport Core Plan

1. Add city-entry and projected Passport history contracts under `lib/grid/core`.
2. Validate city identifiers and entry timestamps at the Core boundary.
3. Sort authoritative entry records deterministically and aggregate first/last entry plus entry count per city.
4. Mark the matching Home City without inventing a stamp when no entry record exists.
5. Verify the projection never carries local Credits or Influence.
6. Keep persistence, API routes, reputation, visitor caps, and residency out of this checkpoint.
