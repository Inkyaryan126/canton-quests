# The Grid — Season Lifecycle Reconciliation

## Problem

Grid world projection can derive that The Surge is live from timestamps, but
persisted grid_seasons.status previously had no lifecycle writer. Systems that
key off persisted status could therefore remain active after Surge began, or
remain playable after the season ended.

## Boundary

The lifecycle reconciler moves only forward:

scheduled -> active -> surge -> complete

It can skip intermediate states if a reconciliation run was missed. It never
regresses status, never auto-starts a draft season, never changes archived, and
leaves complete for the separate archive operation.

The configured city and season are resolved server-side. Browser callers never
supply season IDs or target statuses.

## Timing

Persisted starts_at and ends_at are required once a season is scheduled.
A valid persisted surge_starts_at wins. If it is null, the reconciler derives
Surge start from ends_at minus seasonTemplate.surgeHours, clamped to starts_at.

This matches the existing Surge timing rule without requiring a second tuning
object.

## Atomic command

grid_reconcile_season_lifecycle locks the season row, recalculates the desired
phase from database timestamps and server time, writes the status update, and
appends grid:season_status_reconciled in the same transaction.

Each target status uses a deterministic idempotency key. Direct execution is
revoked from public, anon, and authenticated roles; service role is the only
database executor.

## Operations

POST /api/admin/grid/season/reconcile is the initial protected operator
boundary. It requires existing admin authentication and the Grid runtime read
gate. It accepts no request body.

A future deployment scheduler can invoke the same service/RPC boundary without
moving lifecycle rules into a public GET or a browser timer.
