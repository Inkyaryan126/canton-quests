# Grid Map Action Wiring Repair

## Regression

`GridCityMap` still contained the server-authoritative territory claim, property acquisition, and development action controls, while `GridWorldClient` still owned the matching handlers and busy state. A later map-extraction integration rendered the component with only `projection`, so those optional controls silently disappeared from the map selection panel even though the separate list/detail controls still worked.

## Repair

Restore the known-good parent props:

- `economyWriteEnabled`
- `busyClaim`
- `busyPropertyAction`
- `onClaimTerritory`
- `onAcquireProperty`
- `onDevelopProperty`

No command logic moves into the map. The map continues to call the existing world-client handlers, which own the server API requests and refresh behavior.

## Regression coverage

The map interaction test now verifies both halves of the contract: `GridCityMap` exposes the action props and `GridWorldClient` actually passes its authoritative handlers into them. This prevents a future component extraction or merge from leaving action-capable UI disconnected again.
