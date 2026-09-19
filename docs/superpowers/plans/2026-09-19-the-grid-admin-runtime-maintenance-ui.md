# The Grid — Game Master Runtime Maintenance UI

## Purpose

The canonical runtime maintenance sweep now has a safe operator surface.

The live Game Master Operations Console at /admin/grid is the correct location
because it already owns live-game visibility for season state, players,
territories, contests, auctions, market activity, NPCs, events, and audit
activity.

The separate Empire Panel remains focused on development/build orchestration and
is not given live-game mutation controls.

## Control

The Runtime maintenance panel calls:

POST /api/admin/grid/runtime/sweep

The browser sends no city, season, season id, current time, feature gates, or
resource authority. The server keeps those decisions.

While the request is running the control is disabled.

## Result visibility

The console reports each maintenance phase separately:

- season lifecycle: updated/current/failed
- expired auctions: processed/skipped/failed, including settled/already-settled/failure counts
- Contract rewards: processed/skipped/failed, including paid/duplicate/failure counts

A partial failure remains visible rather than being converted into a generic
success message.

After the sweep returns, the console reloads its normal read-only overview so
season and auction state reflect the maintenance pass immediately.

## Scope

This UI does not add a scheduler and does not deploy or activate production.
It only exposes the already-authenticated, server-authoritative maintenance
operation to a Game Master.
