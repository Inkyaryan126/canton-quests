# Grid Signed Location Attestation Token

## Goal

Give the location-enhancement claim service a trusted proof envelope without allowing the browser to declare its own zone or sending precise GPS data into Grid Core.

## Token boundary

A trusted server-side presence verifier issues a short-lived HMAC-SHA256 token containing only:
- verification id;
- coarse game zone id;
- player id;
- season id;
- verification timestamp;
- expiry timestamp;
- token version.

Latitude, longitude, coordinate arrays, and location accuracy are never part of the token.

## Binding

Verification requires the currently authenticated player id and server-resolved season id to match the signed payload. A valid token for one account or season cannot be replayed into another.

## Time safety

Tokens fail closed when expired, future-dated, malformed, or configured with an expiry that is not after the verification time. Core still applies its own rule-specific maximum proof age after signature verification.

## Signature

HMAC-SHA256 uses a server-only secret of at least 32 bytes. Verification uses constant-time signature comparison. The browser may carry the token but never receives the signing secret.

## Follow-on

Wire a trusted presence verifier to issue these tokens, then add an authenticated location-enhancement claim route that resolves player, season, and rule server-side before calling the existing claim service.
