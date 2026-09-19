# The Grid Market Core Plan

1. Define explicit Market config, item, quote, and fixed-price settlement types.
2. Validate tax/cooldown config with no defaults.
3. Settle Credits-only eligible property/asset sales deterministically.
4. Reject self-dealing, insufficient Credits, ownership mismatch, non-tradable items, major landmarks, and cooldown bypass.
5. Follow with server-authoritative persistence/event-ledger settlement in a separate lane.
6. Define auctions only after bidding/timing rules are explicitly locked.
