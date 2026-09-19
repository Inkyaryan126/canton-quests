# The Grid — Live Dominance Heat

## Purpose

Dominance Heat is the anti-snowball pressure system. The core math already
existed, but no live Canton data reached it.

This lane makes Heat measurable from authoritative Founding Season territory
ownership and gives authenticated players a private strategy screen.

## Canton thresholds

Canton uses three monotonic bands:

- Warm at 35% city concentration
- Hot at 50%
- Critical at 75%

Each higher band increases every configured counter-pressure effect. The
configuration remains standalone while shared season-package contracts are
being reconciled by a separate agent lane.

## Live measurement

The current live source is territory share because Canton does not yet persist
an authoritative strategic-value score per territory.

Eligible territory count comes from grid_territories for the configured Canton
city. Personal control comes from grid_season_territory_state.

If the player has an active Alliance membership, alliance concentration is the
union of territories owned by all active members in that same season.

The public projection strips player UUIDs, alliance UUIDs, and season UUIDs.

## Truthfulness boundary

The Heat engine defines projected effects for neutral-faction pressure, border
rewards, upkeep surcharge, rival objectives, and anti-monopoly Contract slots.

Those downstream systems do not yet consume the live Heat projection. The
player screen therefore labels them as projected rules and explicitly says no
surcharge or bonus has already been charged or paid.

This avoids turning a core rule model into a misleading gameplay claim.

## Player surface

GET /api/grid/dominance-heat is authenticated, private/no-store, and gated by
the existing Grid world-read flag.

The private page /grid/heat shows personal exposure and, when relevant,
Alliance exposure. It is linked from the authenticated return brief and remains
off the public Grid teaser.
