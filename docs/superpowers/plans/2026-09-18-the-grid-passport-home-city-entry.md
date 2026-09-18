# Grid Passport Home City Entry Integration

## Goal

Make the first permanent Passport stamp happen automatically at the moment an authenticated player confirms Home City.

## Boundary

- Home City remains resolved from the configured city package on the server.
- One server timestamp is shared by Home City confirmation and the Passport entry.
- The Passport idempotency key is deterministic from authenticated player + authoritative city, so retries never inflate entry counts.
- The internal city UUID may move between trusted server services but is still removed from the HTTP response.
- A Passport failure returns an error; retry is safe because Home City confirmation already accepts the same existing Home City and Passport persistence is idempotent.
- No Credits, Influence, Command Points, ownership, or seasonal state are part of this integration.
