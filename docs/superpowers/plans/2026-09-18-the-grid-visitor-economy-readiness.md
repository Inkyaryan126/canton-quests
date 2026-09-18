# Grid Visitor Economy Readiness Boundary

## Goal

Prevent server routes from treating missing visitor-economy evidence as zero and accidentally granting actions before the required tracking systems exist.

## Evidence contract

Home City `null` is a valid `unassigned` state. The four numeric facts are independently nullable until authoritative persistence exists:
- local investment Credits;
- owned property count;
- deployments used;
- residency points.

Known values are always validated. If any required fact is unavailable, the service returns `status=incomplete`, names the missing facts, returns no projection, and returns no action decision.

## Deliberate boundary

No Supabase adapter is added in this checkpoint. Property count can be derived today, but the exact definition of "local investment" is not yet approved and Grid deployment/residency tracking does not exist. Building an adapter now would force invented semantics or false zeroes.

Once those sources are authoritative, one adapter can satisfy this port without changing visitor-economy Core or action routes.
