# The Grid Takeover Persistence Design

## Decision

A player-to-player territory ownership change atomically transfers only properties in that territory that are owned by the defeated territory owner. Neutral properties and third-party holdings are preserved.

Property takeover damage is configuration, not a hardcoded game constant. `season.config.economy.takeover` carries `developmentRetentionBps`, `conditionDamageBps`, and `conditionFloorBps`, matching the existing pure `resolveGridTakeoverDamage` model. Missing or malformed live policy fails closed.

Canton Founding Season starts with an explicit neutral policy: 100% development retained and zero condition damage. This completes ownership/cooldown persistence without inventing punitive balance. Future damage tuning changes configuration only.

## Atomic effects

On a captured owned territory:

- defeated-owner properties inside the territory transfer to the attacker;
- `acquired_at` resets to the territory capture timestamp, activating existing market cooldown rules;
- retained development is integer-floor basis-point arithmetic;
- a level reduced to zero clears `development_branch` to preserve the existing schema invariant;
- condition damage uses the existing floor rule and never repairs already-damaged property;
- open fixed-price listings from the defeated owner are cancelled so stale listings cannot block or sell the new owner's property;
- one append-only `grid:takeover_properties_applied` event records policy, counts, owner transition, and per-property before/after facts.

Neutral claims, resets to neutral, and same-owner writes do not trigger takeover behavior.

## Database boundary

The behavior is attached to the authoritative `grid_season_territory_state.owner_player_id` transition with an `AFTER UPDATE` trigger. That keeps contest capture and future legitimate territory-transfer paths coherent without duplicating takeover logic in each command function.

The trigger is `SECURITY INVOKER`, uses an empty search path with schema-qualified relations, and direct execution is revoked from public/anon/authenticated roles. Normal Grid mutation paths remain service-role controlled.
