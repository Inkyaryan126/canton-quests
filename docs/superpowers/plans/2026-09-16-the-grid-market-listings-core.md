# The Grid — Fixed-Price Public Market Core

**Date:** 2026-09-16
**Lane:** `market-listings-core`
**Branch:** `grid-market-listings-20260916`
**Worktree:** `/private/tmp/grid-market-listings`

## Goal

Implement the fixed-price half of the Grid Public Market described in the multi-city engine design.

This builds on the Market 1 direct-deal rules and remains a pure deterministic core. It does not write balances, ownership, listings, or events.

## This lane owns

- Fixed-price listing rule validation.
- Seller/city/asset validation.
- Price and duration bounds.
- Post-capture property trade cooldowns.
- Major-landmark and non-tradable exclusions.
- Scheduled/open/expired projection.
- Buyer city and balance checks.
- Buyer-paid transaction tax as an economic sink.
- Atomic purchase planning.
- Seller-only cancellation.
- Re-verification of asset ownership/tradability/cooldown at purchase time.

## This lane intentionally does not own

- Listing database tables.
- Escrow.
- Supabase RPCs.
- Public market APIs.
- Search/filter/sort UI.
- Player notifications.
- Auction logic.
- Direct-deal negotiation.
- Historical anti-collusion scoring.

Those should integrate after the deterministic contract is accepted.

## Purchase transaction model

A persistence layer should execute a successful purchase plan inside one transaction:

1. Lock the listing row.
2. Lock the buyer economy row.
3. Lock the seller economy row.
4. Lock the listed asset/property row.
5. Rebuild the purchase plan from fresh database state.
6. Debit buyer price + tax.
7. Credit seller price.
8. Burn the tax.
9. Transfer ownership.
10. Mark the listing sold and record buyer/time.
11. Append the market transaction event.
12. Commit everything together.

Any failed re-check rolls the whole purchase back.

## City isolation

The seller, buyer, listing, and listed asset must all resolve to the same city economy. Public Market trades do not move Credits or assets between cities.

## Trade cooldown

The property cooldown is re-checked both when the listing opens and when a buyer purchases. That prevents stale listings from bypassing ownership/capture restrictions after underlying state changes.

## Status projection

Persisted listing state stays simple: open, sold, or cancelled.

The pure projection derives scheduled and expired states from timestamps without requiring background cron jobs just to make an old listing stop appearing as purchasable.
