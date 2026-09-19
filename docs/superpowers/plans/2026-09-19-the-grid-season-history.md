# The Grid — Season History

Season Archive freezes authoritative end-of-season state. Season History is the
public, read-only projection of that permanent record.

The API resolves the configured city and season on the server. Callers do not
supply city IDs, season IDs, player IDs, standings, or archive identifiers.

Only an archived season is readable. Before archive, the endpoint returns an
empty history state so the UI can explain that live standings have not been
frozen yet.

The public projection exposes final rank, callsign/avatar, City Power, Grid
Rating, and XP. It intentionally omits player UUIDs, season UUIDs, City Power
breakdown internals, private account fields, and all mutable season state.

Every final placement remains visible. If a player no longer has a usable public
callsign, the service substitutes a rank-based public label instead of dropping
that standing and corrupting the permanent order.

The service validates archive scope, timestamp, count, contiguous strict ranks,
score bounds, duplicate players, and champion membership before returning any
record.

Archived responses receive a longer public cache because the record is
immutable. The pre-archive empty state uses the same short cache window as live
leaderboards.

The player page lives at /grid/history and is linked from Rankings. It presents
the archived season champion and the complete locked City Power order.
