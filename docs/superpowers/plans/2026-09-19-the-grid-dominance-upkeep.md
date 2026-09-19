# Grid Dominance Heat Alliance Upkeep Enforcement

## Goal

Make the already-configured Dominance Heat `upkeepSurchargeBps` mechanically real in the existing server-authoritative Alliance Influence upkeep settlement. This lane does not create a new upkeep cadence, scheduler, player-facing mutation route, or personal-player upkeep system.

## Authority

Alliance upkeep already resolves active members plus authoritative seasonal territory ownership and adjacency. The same evidence bundle now includes the total eligible territory count for the season city. The service projects the Alliance's territory-share Dominance Heat with the existing pure Heat engine, then passes the resulting band and configured upkeep surcharge into the existing upkeep core.

No browser supplies Heat, territory counts, a band, or a surcharge. Every settlement caller must supply an explicit city Heat config; there is no nullable bypass. A city that intentionally has no Heat can supply an explicit empty-band config.

## Math

The Heat surcharge is applied after existing base, member, fragmentation, and large-Alliance costs are combined for one tick. Basis-point multiplication uses the repository's established deterministic floor convention with `BigInt` arithmetic:

`heat surcharge = floor(pre-Heat upkeep × upkeepSurchargeBps / 10000)`

The surcharge is then included in per-tick and total Influence upkeep. Positive surcharge basis points require a non-null Heat band identifier.

## Audit and replay compatibility

New upkeep breakdowns include the Heat band, configured surcharge basis points, and actual surcharge Influence per tick. Those fields are optional at the persistence type boundary so older immutable upkeep events can still replay without mutation. New settlements always emit all three fields.

The existing locked, idempotent `grid_settle_alliance_upkeep` RPC already persists the breakdown JSON and authoritative totals atomically, so no schema migration is required. Replays still return before reading mutable Alliance or territory state.

## Deliberate limits

- No personal-player upkeep is invented.
- No upkeep tick duration or scheduler is invented.
- No new Heat thresholds or Canton tuning are introduced.
- Border reward, rival-objective, and anti-monopoly Contract effects remain separate future integrations because their authoritative action paths are not yet defined.
