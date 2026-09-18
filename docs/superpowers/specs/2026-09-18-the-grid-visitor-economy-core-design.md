# The Grid Visitor Economy Core

## Goal

Implement the multi-city rule that global reputation may travel while city-local wealth and economic dominance do not.

## Standing

Core projects a player as home, visitor, or unassigned for a target city. Home players are not constrained by visitor policy. Visitors receive configured caps. A missing Home City is treated as visitor-restricted so incomplete profile state cannot become an economic bypass.

## Visitor controls

The first universal policy supports:
- local investment cap;
- local property limit;
- deployment allowance;
- residency progress threshold.

These are policy limits only. Affordability, property legality, contest state, and other gameplay requirements remain in their own server-authoritative systems.

## Residency

Crossing the configured residency threshold reports eligibility. Core does not silently promote the player, replace Home City, or lift visitor caps because the product design has not yet approved those transition rules.

## Economy isolation

Credits, Influence, and Command Points are local-economy resources. Any non-zero transfer between different city slugs is denied by Core. Same-city movement remains available to the normal economy commands.

Permanent reputation and Passport history are intentionally outside this local-wealth transfer type.

## Multi-city requirement

No launch-city names or special cases exist in this module. City Packages or server policy choose tuning values; Core applies the same rules to City 001, City 002, and later cities without changes.
