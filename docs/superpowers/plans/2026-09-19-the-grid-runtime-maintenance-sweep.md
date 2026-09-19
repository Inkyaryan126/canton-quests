# The Grid — Runtime Maintenance Sweep

## Problem

Several deterministic maintenance systems existed independently:

- Founding Season lifecycle reconciliation
- expired property-auction settlement
- Contract reward-outbox settlement

Season lifecycle and Contract rewards required separate manual admin calls.
Auction settlement ran opportunistically when a player loaded active auctions.
That meant routine maintenance had no single authoritative operator entrypoint.

## Solution

POST /api/admin/grid/runtime/sweep composes the existing services without
duplicating their business logic.

The endpoint is admin-only, no-store, and requires the Grid runtime read gate.
The browser cannot choose city, season, season id, current time, or feature
gates. Canton Founding Season identity and the server clock are resolved on the
server.

The request may only provide bounded batch sizes:

- auctionLimit, default 25, range 1..100
- contractRewardLimit, default 25, range 1..100

## Phase order

1. Reconcile Founding Season lifecycle.
2. If auction writes are enabled and lifecycle produced a season id, settle
   expired auctions through the existing idempotent auction sweep.
3. If Contract reward settlement is enabled, settle pending reward intents
   through the existing exactly-once reward service.

The lifecycle result supplies the authoritative season id to the auction phase.

## Failure behavior

Input is validated before any side effect.

A lifecycle failure blocks the auction phase because auction settlement requires
an authoritative season id, but Contract reward settlement still runs because
its outbox is independently authoritative.

A disabled subsystem is reported as skipped rather than failed.

The auction and reward batch services already isolate individual item failures.
The maintenance sweep preserves those detailed results and sets overall success
to false when any phase or item fails, without hiding successful work.

## Scheduling boundary

This lane deliberately does not add a Vercel cron or production scheduler.
The repository currently has no Grid scheduling convention or vercel.json cron
configuration. This endpoint provides one safe, deterministic maintenance
operation that a future deployment-specific scheduler can invoke.

No production deployment or scheduler activation is performed by this lane.
