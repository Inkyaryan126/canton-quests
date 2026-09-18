# Grid PvE Strongholds Player Screen

## Goal

Turn the completed PvE backend into a usable authenticated player loop without coupling it to the larger City Board component.

## Route

`/grid/strongholds` is a standalone mobile-first combat surface. It reads:
- `/api/grid/strongholds` for live NPC strongholds and server-derived eligible adjacent source territories;
- `/api/grid/stronghold-contests` for the authenticated player's active PvE battles;
- `/api/grid/world` for joined state, wallet Influence, and existing contest commitment bands.

## Actions

- Start: player chooses only from server-derived adjacent owned source territories and affordable existing Signal Dice commitment bands.
- Round: client sends only a fresh idempotency key. Dice remain server generated.
- Retreat: client sends only a fresh idempotency key; surviving Influence is refunded by the atomic backend.
- Resume: active contests load on refresh/reconnect.
- Replay: battle history loads from the sanitized attacker-only history endpoint.

## Stronghold list source derivation

The authenticated stronghold list now resolves the current world runtime, identifies territories actually owned by the viewer, and intersects them with city-package adjacency edges for each stronghold target. The response adds `attackSourceTerritorySlugs` and `targetNeutral`. The PvE start RPC remains the authority and independently rechecks ownership, adjacency, neutral target, cross-mode target locks, and available Influence.

No automatic Canton stronghold definitions or tuning are introduced by this UI.
