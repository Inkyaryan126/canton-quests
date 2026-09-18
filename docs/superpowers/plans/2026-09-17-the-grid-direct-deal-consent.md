# Grid Market 6 — Direct Deal Consent

## Goal

Close the authorization gap between deterministic Direct Deal planning and Market 5 atomic settlement. A Direct Deal must exist as immutable server-side terms, and the named counterparty must explicitly accept those exact terms before Credits or property ownership can move.

## Owned scope

- `lib/grid/server/direct-deal-proposal-port.ts`
- `lib/grid/server/direct-deal-proposal-service.ts`
- `lib/grid/server/supabase-direct-deal-proposal.ts`
- `supabase/migrations/20260917204500_grid_direct_deal_proposals.sql`
- `tests/grid-direct-deal-proposal-service.test.ts`
- `tests/grid-direct-deal-proposal-schema.test.ts`

No Market API or player UI files are owned by this lane. The active Market UI lane can continue independently.

## Consent model

A proposal freezes:
- season/city and both player identities
- Credits offered by each side
- property IDs offered by each side
- transaction tax basis points
- property trade cooldown minutes
- maximum assets per side
- creation and expiration timestamps

Terms are immutable after insertion. The proposer may cancel an open proposal. Only the named counterparty may accept it, and acceptance/cancellation serialize on the same locked proposal row.

## Acceptance boundary

Acceptance must provide a canonical Market 4 transaction whose source is `direct-deal`, source ID is the proposal ID, participants are the proposal players, timestamp is the command time, Credit directions exactly match the persisted offers, and property directions exactly match the persisted property sets.

Property transfers are revalidated for city, current ownership, tradability, major-landmark exclusion, cooldown, and active fixed-price listings. `estimatedValueCredits` must match authoritative `grid_properties.base_value`; client-authored valuation cannot alter trade-integrity facts.

After those checks, the database calls `grid_settle_market_transaction` using the tax/cooldown rules frozen on the proposal. Market 5 remains the only component that actually moves Credits/properties and writes the canonical market transaction ledger.

## Security and replay rules

Proposal command RPCs are service-role only and use invoker security. Create, cancel, and accept are idempotent through the immutable Grid event ledger. Acceptance uses a derived settlement idempotency key so the consent event and Market 5 settlement cannot collide. Generic assets remain unsupported until authoritative inventory ownership exists.

No public acceptance endpoint is added here. A future authenticated API must derive the acting player from the session; it must never accept a client-supplied claim about who consented.

## Verification

TDD red phase confirmed both new suites failed because the implementation did not exist. The completed implementation is verified by the Market 1–6 focused suite, TypeScript/lint/diff gates, and a rollback-only local PostgreSQL smoke test that creates two players, a season, two owned properties, a proposal, accepts it, verifies Credit balances and swapped ownership, confirms one market-ledger transaction, and rolls everything back.
