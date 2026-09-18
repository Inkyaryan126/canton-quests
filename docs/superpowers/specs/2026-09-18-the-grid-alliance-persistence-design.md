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
