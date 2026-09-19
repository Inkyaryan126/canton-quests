# The Grid Market Core Design

**Status:** IMPLEMENTED FOUNDATION — 2026-09-19

## Goal
Provide deterministic, city-agnostic settlement primitives for the explicitly approved Market & Trading rules without prematurely defining auction bidding mechanics.

## Boundary
This core supports Credits-priced fixed sales of eligible properties/assets. Influence and Command Points never appear in the settlement contract, making them structurally non-tradable. Major landmarks are rejected from free trading. City/season configuration supplies transaction tax and post-capture cooldown; core defines no hidden defaults.

## Settlement
A fixed-price sale validates distinct buyer/seller, seller ownership, tradability, major-landmark protection, cooldown expiry, and buyer Credits. Tax is an economic sink calculated in basis points with deterministic floor rounding. Seller receives price minus tax; buyer pays full price; item ownership transfers to buyer.

## Deferred intentionally
Auction bidding, bid increments, closing windows, anti-sniping, direct multi-item barter, server persistence, event-ledger settlement, and anti-collusion scoring require their own explicit contracts. They are not invented in this foundation.
