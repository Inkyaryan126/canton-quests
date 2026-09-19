# The Grid — Season Conclusion & Archive

## Goal

Give an ended Grid season one safe, auditable path from live play to permanent
history.

The archive operation is deliberately destructive and operator-only. It freezes
the final City Power ordering, closes safe end-of-season commitments, writes
permanent Passport history, and changes the season to archived in one database
transaction.

## Dependency

This lane is based on the completed live City Power lane. Final placement uses
the city package's City Power config and the same deterministic core scoring
engine used by the live ranking.

Final placement is strict: City Power, then Grid Rating, then XP, then stable
player ID. Live boards may display tied ranks, but the permanent season archive
needs exactly one champion.

## Every joined player counts

Final candidates begin with grid_player_season_state, not the progression
table. A player with no progression row receives a zeroed progression snapshot
and still receives a final placement.

## Close blockers

The archive fails closed while any live PvP or PvE contest remains. It also
blocks while a Contract reward outbox row is still unprocessed; completed
rewards must not be buried by season closure.

At the season end time, the archive safely reconciles other commitments:

- scheduled/open auctions settle through grid_settle_property_auction
- fixed-price listings cancel through their existing cancellation RPC
- Direct Deal proposals cancel through their existing cancellation RPC
- still-active Contracts become expired and write an immutable expiry event

Those paths reuse existing authoritative commands where money/ownership is
involved instead of bypassing them.

## Permanent records

The transaction writes:

- one grid_season_archives row
- one strict grid_season_final_standings row per joined player
- final City Power into grid_player_season_state.city_power
- Passport city-rank events for every player
- seasonal trophy events for the top three
- a championship event for rank one
- final territory-control Passport events
- one grid:season_archived audit event

The season status changes to archived only after all of those writes succeed.

## Passport cache

Passport events are durable source-of-truth history. After the transaction
commits, the service rebuilds each affected player's cached Passport projection.
A cache rebuild failure does not roll back the permanent archive; failed player
IDs are returned so the cache can be reconciled again.

## Safety

POST /api/admin/grid/season/archive requires:

- authenticated admin access
- GRID_SEASON_ARCHIVE_ENABLED=1
- a non-empty idempotency key
- explicit confirmation of the configured season slug
- a configured City Power policy
- the season end time to have passed

The browser never supplies city IDs, season IDs, standings, player IDs, City
Power values, or Passport events.
