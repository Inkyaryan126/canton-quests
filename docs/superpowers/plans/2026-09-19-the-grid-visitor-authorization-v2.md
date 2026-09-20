# Grid visitor authorization boundary

## Scope

Provide a reusable server-only authorization boundary for future visitor economy/game action routes. The boundary receives only the player, target city, and requested Core action. It resolves policy and reads visitor evidence through injected authoritative adapters; it performs no persistence writes.

## Contract

- `GridVisitorEconomyPolicyPort` accepts only an explicit resolved policy or `null`.
- `GridVisitorEconomyAuthoritativeEvidencePort` is the server evidence adapter already used by visitor economy readiness.
- `authorizeGridVisitorAction` delegates cap/limit decisions to `evaluateGridVisitorActionReadiness` and Core's `evaluateGridVisitorAction` semantics.
- Missing policy/evidence and contradictory adapter results return deterministic deny results with explainable reason fields.
- Caller-supplied standing, counters, residency, or authorization facts are not accepted.

## Verification

The focused authorization, visitor service, Core, policy, and evidence adapter tests cover resident and visitor authorization, policy denial, missing policy/evidence, contradictory evidence, and deterministic reasons.
