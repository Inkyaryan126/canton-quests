# Grid Passport Persistence

## Goal

Turn the replayable Passport Core into a server-side rebuild/cache boundary without allowing city-local economy state to cross cities.

## Source of truth

Passport history is derived only from immutable, Passport-specific rows in grid_game_events where actor_player_id is the target player. Database event id, event type, and created timestamp override any same-named payload values before Core validation.

The adapter intentionally does not infer permanent career achievements from unrelated gameplay events. Producers must append explicit passport events when a durable career fact is awarded.

## Cache

Rebuild replays every selected event through projectGridPassport and only then upserts grid_player_profiles.passport plus grid_player_profiles.global_reputation.

No Credits, Influence, Command Points, City Power, property state, territory ownership, or other season-local wealth is read or written by this boundary.

## Failure rule

Malformed authoritative events fail the rebuild before save. The previous cache therefore remains intact instead of being replaced by a partial or silently repaired projection.

## Follow-on

Add command producers that append the explicit Passport events at approved career milestones, then expose the cached projection through a private authenticated Passport read endpoint.
