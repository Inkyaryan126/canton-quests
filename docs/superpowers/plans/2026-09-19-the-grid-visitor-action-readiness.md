# Grid Visitor Action Readiness

## Goal

Stop unrelated visitor telemetry from blocking a server-authoritative action decision while preserving strict full visitor-economy projections.

## Rules

`readGridVisitorEconomyReadiness` remains unchanged: a complete visitor dashboard/projection requires local investment, property count, deployments used, and residency points.

`evaluateGridVisitorActionReadiness` is narrower:

- `invest` requires only `localInvestmentCredits`;
- `acquire-property` requires only `ownedPropertyCount`;
- `deploy` requires only `deploymentsUsed`;
- Home City actions require none of the visitor-only counters because visitor restrictions do not apply there.

Residency is not used to authorize these actions and therefore does not block them. Missing or malformed action-relevant evidence still fails closed. Core remains the source of truth for cap/limit decisions; the server boundary only decides whether enough authoritative evidence exists to call Core.
