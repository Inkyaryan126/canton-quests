# Grid Visitor Economy Evidence Adapter

## Goal

Back visitor readiness with facts Supabase can authoritatively prove today without inventing unresolved multi-city accounting semantics.

## Proven facts

The adapter resolves:

- target city identity from `grid_cities`;
- Home City from `grid_player_profiles.home_city_id` and `grid_cities.slug`;
- owned property count when the target city has exactly one playable (`active` or `surge`) season.

Property count is intentionally `null` when there are zero or multiple playable seasons because choosing one would be ambiguous.

## Explicitly unknown facts

The adapter returns `null` for:

- `localInvestmentCredits`;
- `deploymentsUsed`;
- `residencyPoints`.

Those values remain unavailable until their accounting/event semantics are settled and persisted. `null` means “not authoritatively proven,” never zero.

## Integration boundary

This adapter does not invent visitor policy values and does not yet alter player action routes. It provides the authoritative evidence boundary those routes can consume once a city/season explicitly configures visitor policy.
