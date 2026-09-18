# Grid Passport Core — City Entry History Design

## Decision

The first Passport slice records only facts already settled by the Grid design: Home City identity and permanent cross-city entry history.

A Passport city stamp contains:
- city identity;
- first entry timestamp;
- most recent entry timestamp;
- number of recorded entries;
- whether that city is the player's Home City.

The projection is deterministic from authoritative city-entry records. Input ordering cannot change the result.

## Deliberately excluded

This slice does not define national-reputation formulas, city-rank scoring, visitor deployment allowances, investment caps, property limits, residency thresholds, trophies, cosmetics, or championship scoring. Those require separate product rules.

Local Credits and local Influence are intentionally absent from the Passport contract. The Passport is permanent cross-city history; city economies remain separately scoped.
