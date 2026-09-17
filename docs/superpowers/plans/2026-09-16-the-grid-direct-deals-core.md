# The Grid — Direct Deals Core

**Date:** 2026-09-16
**Lane:** `direct-deals-core`
**Branch:** `grid-direct-deals-20260916`
**Worktree:** `/private/tmp/grid-direct-deals`

## Goal

Implement the deterministic, city-agnostic rules engine for direct player-to-player deals described in the Grid design.

A direct deal may exchange Credits, eligible properties, and eligible generic assets. Influence and Command Points are intentionally absent from the contract.

## This lane owns

- Deal/rule validation.
- Same-city enforcement.
- Proposal time windows.
- Credit balance checks.
- Per-side asset-count caps.
- Transaction-tax calculation as an economic sink.
- Ownership and tradability checks.
- Major-landmark exclusion.
- Post-capture property trade cooldowns.
- Deterministic asset-transfer ordering.
- Atomic settlement planning.
- Audit facts for future transaction logging and anti-collusion analysis.

## This lane intentionally does not own

- Supabase persistence.
- Offer/accept/cancel APIs.
- Escrow.
- Public market listings.
- Auctions.
- Player chat/negotiation UI.
- Anti-collusion scoring across historical transactions.
- City-package tuning.
- Progression rewards.

Those can integrate after this pure settlement contract is accepted.

## Atomic settlement model

The core returns a settlement plan rather than mutating balances or ownership.

A persistence layer can execute that plan inside one database transaction:

1. Lock both player economy rows.
2. Lock all offered asset/property rows.
3. Re-verify ownership, city, cooldown, and balances.
4. Apply Credit transfers.
5. Burn transaction tax.
6. Transfer asset ownership.
7. Append a transaction/audit event.
8. Commit all changes together or roll everything back.

This keeps partial trades impossible.

## Economic isolation

Both players and every transferred asset must belong to the proposal city. A deal cannot move Credits or property between city economies.

## Tax behavior

Tax is charged on each side's outgoing Credits. Each player must be able to fund their own outgoing Credits plus their own tax before settlement.

Received Credits cannot be used to satisfy the same atomic deal's upfront debit requirement.

## Property cooldown

Properties may be blocked for a configurable period after capture/acquisition. If acquisition time is missing or invalid while a cooldown is enabled, settlement fails closed rather than guessing.

## Anti-collusion foundation

This core does not pretend it can detect collusion from one trade. It emits stable audit facts such as gross Credit flow, total tax, property count, other asset count, zero-Credit barter, and reciprocal Credit flow.

A later historical-analysis system can combine those facts across accounts, time, repeated counterparties, value estimates, and network behavior.
