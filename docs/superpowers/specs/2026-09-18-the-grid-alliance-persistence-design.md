# The Grid Alliance Persistence Design

**Status:** APPROVED FOR LOCAL IMPLEMENTATION — 2026-09-18

## Goal
Persist the verified city-agnostic Alliance core without weakening its one-Alliance-per-season, personal-ownership, cooldown, or bounded-pool invariants.

## Boundary
This lane owns only Alliance persistence and server adapters. Chat, progression, map rendering, coordinated contests, projects, market systems, and production activation remain separate lanes.

## Tables
`grid_alliances` stores one seasonal Alliance identity, leader, lifecycle status, pooled Influence, and optimistic revision. `grid_alliance_memberships` stores immutable join/leave history with the cooldown boundary required by the pure core.

Membership rows repeat `season_id` intentionally so PostgreSQL can enforce one active Alliance per player per season and a composite foreign key can prove the membership season matches its Alliance season.

## Invariants
- pooled Influence is a non-negative integer and never stores Credits or Command Points;
- one active membership per `(season_id, player_id)` via a partial unique index;
- active memberships have no leave/cooldown timestamps;
- closed memberships have `left_at` and a cooldown at or after leave time;
- Alliance identity is unique by `(season_id, slug)`;
- direct browser roles receive no table privileges; trusted server code owns mutations;
- optimistic `revision` supports later compare-and-swap commands.

## Follow-on
The next lane adds a server port/service consuming the existing Alliance core for create/join/leave/contribution/upkeep commands. Atomic resource transfer can then be added as a narrowly scoped trusted RPC rather than spreading transaction logic through UI routes.


## Atomic pooled Influence contribution
Alliance 3 moves personal Influence into the bounded Alliance pool without exposing a client-side transfer primitive. The server evaluates the existing pure-core contribution decision first, then an optimistic service-role RPC locks the Alliance and player-season rows and applies only that exact decision if both expected states still match. Every successful transfer records an idempotent `grid_game_events` entry. Retries replay the original event; stale state fails closed instead of silently recalculating a different transfer. Credits and Command Points are never touched.


## Coordination upkeep persistence
Upkeep is settled against a server-read snapshot of active membership and seasonal territory connectivity. The service projects network fragmentation through the verified pure core, calculates exact upkeep, and passes that decision to a locked optimistic RPC. Membership changes advance Alliance revision, so concurrent join/leave or pool changes fail closed. Territory ownership observed after the snapshot applies to the next settlement tick rather than retroactively changing the current calculation. Every settlement uses a caller-supplied idempotency key so schedulers can safely retry a tick without charging it twice. Shortfall is recorded as an event outcome and never becomes negative pooled Influence or debt.


## Leader disband lifecycle
A leader who wants to exit may disband the Alliance. The command uses the same configured leave cooldown for every active member and closes all memberships in the same database transaction that marks the Alliance disbanded. Existing pooled Influence remains on the disbanded Alliance record and is not refunded, transferred, or converted, preventing disband/recreate resource laundering. The command is idempotent through the game-event ledger and checks both Alliance revision and pooled Influence before applying.
