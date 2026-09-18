# Grid World Live Strongholds

## Goal

Replace the City Board world feed's empty NPC stronghold placeholder with the same authoritative registry + runtime-evidence projection used by the dedicated Strongholds player API.

## Behavior

When `GRID_WORLD_READ_ENABLED` is on, `/api/grid/world` resolves live strongholds through `listGridNpcStrongholdLiveWorld`. Ready projections are returned in the existing `strongholds` response field, allowing the map/client layer to render them without changing the world response contract.

If required NPC runtime evidence is incomplete, the world endpoint fails soft: it returns an empty stronghold collection and appends only a generic `Grid stronghold runtime incomplete` warning. Exact missing evidence facts remain restricted to the authenticated Game Master runtime endpoint.

Unexpected stronghold-read errors likewise degrade to an empty collection plus a generic warning. Dynamic events and the rest of the world projection continue independently.
