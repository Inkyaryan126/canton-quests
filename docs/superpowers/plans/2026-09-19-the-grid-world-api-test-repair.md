# Grid World API Clock Contract Test Repair

The world API now captures one server timestamp in `const now` and reuses it across the world projection and related live projections. The older test asserted the obsolete inline expression `now: new Date().toISOString()` and failed even though the newer implementation provides a stronger consistency guarantee.

The repaired test verifies that the route creates exactly one ISO server clock and passes that same value to `buildGridWorldProjection` as both `now` and `generatedAt`. Production route behavior is unchanged.
