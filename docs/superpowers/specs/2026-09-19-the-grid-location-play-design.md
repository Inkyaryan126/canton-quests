# The Grid Location-Enhanced Play Design

## Product boundary

The Grid remains fully viable remotely. Location verification can unlock optional enhancement benefits only; it must never become the sole path for an essential activity.

## Trust boundary

The web/native platform may collect a one-time precise location measurement after player permission. That raw measurement is sent to the verification endpoint and is used only to evaluate a server-configured coarse game zone. The browser does not declare the zone, season, player identity, or reward.

Browser geolocation is not treated as tamper-proof GPS hardware evidence. The server verifies the measurement against configured geometry and an accuracy policy, then turns it into a short-lived signed proof. Higher-assurance anti-spoofing can be layered later without changing Grid Core.

## Zone verification

A zone contains server-side latitude/longitude, radius, and maximum accepted reported accuracy. Verification requires:

- valid coordinate ranges;
- finite non-negative reported accuracy;
- accuracy no worse than the zone maximum; and
- `distance to center + reported accuracy <= zone radius`.

The last rule requires the complete reported accuracy envelope to fit inside the zone. Edge readings with weak accuracy fail closed.

## Signed proof

A successful verification issues the existing HMAC-SHA256 attestation token containing only verification id, coarse zone id, authenticated player id, authoritative season id, verification time, expiry, and version. Raw coordinates and accuracy are absent.

Proof lifetime is capped at 15 minutes and also capped by the rule-specific verification age and season end.

## Claim

The authenticated claim endpoint receives rule id, signed attestation token, and idempotency key. It re-resolves the rule and season from server state, verifies the token against the authenticated player and authoritative season, then calls the existing race-safe location enhancement grant service.

The persistent grant ledger continues to store no precise GPS data.
