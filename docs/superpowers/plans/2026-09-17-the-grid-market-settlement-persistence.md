# The Grid — Market 5 Settlement Persistence

## Goal

Turn the deterministic Market 1–4 engines into a durable, server-authoritative settlement boundary without creating a second accounting path. Direct Deals and fixed-price property purchases both normalize into `GridMarketTransactionRecord` and settle through one atomic persistence RPC.

## Owned scope

- fixed-price property listing persistence and lifecycle commands
- canonical immutable market transaction persistence
- atomic Credits + property settlement
- tax sink verification
- property ownership/city/cooldown verification at commit time
- immutable event-ledger audit record
- service-role Supabase adapter and command validation

## Settlement invariants

1. Settle both players' accrued resources before changing Credits.
2. Lock both player season-state rows before calculating final balances.
3. Lock every transferred property and verify the sender still owns it.
4. Re-check city isolation, tradability, major-landmark policy, and cooldown at settlement time.
5. Recompute transaction tax from actual outgoing Credit flow; never trust a client tax total.
6. Reject any settlement that would create a negative Credit balance.
7. Apply both player balances, property ownership, listing state, canonical transaction row, and audit event in one database transaction.
8. Persist idempotent results so retries cannot double-charge or double-transfer.

## One ledger, two sources

`direct-deal` and `fixed-price` transactions use the same canonical transaction table and the same settlement RPC. Fixed-price purchases additionally lock and verify the persisted listing: property, seller, buyer direction, price, status, and sale window must all match the canonical transaction.

## Intentional boundary: generic assets

The core model already understands an `asset` transfer kind, but the current Grid persistence model has no authoritative generic inventory/asset ownership table. Market 5 therefore rejects generic asset settlement at the persistence boundary. Credits and properties are authoritative now; generic assets should be enabled only after an inventory system can provide the same ownership, locking, and transfer guarantees.

## Intentional boundary: no public settlement endpoint yet

This slice does not expose a browser/client endpoint that accepts a canonical transaction or settlement plan. A fixed-price purchase can eventually be safely reconstructed from a persisted listing plus the authenticated buyer, but a Direct Deal also needs durable counterparty consent. Accepting a client-authored transaction before that consent model exists would allow a caller to claim that another player agreed to a trade.

The safe follow-on is a Market 6 command layer that persists Direct Deal proposals/acceptance and reconstructs settlement inputs from trusted server state. Only then should authenticated public purchase/accept routes call this persistence layer.

## Non-scope

- generic inventory/collectible ownership
- public Market UI
- public settlement API
- Direct Deal proposal/acceptance persistence
- auction settlement changes
- city-specific pricing/tax tuning
- production migration application

## Verification

Focused tests cover server validation/adapters, service-role RPC routing, schema/RLS/immutability, resource settlement, atomic wallet/property changes, tax recomputation, listing verification, city isolation, tradability, landmark rules, cooldown enforcement, idempotency, and audit logging. The complete Market 1–5 chain plus repository TypeScript and diff checks must remain green before commit.
