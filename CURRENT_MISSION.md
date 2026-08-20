# CANTON QUESTS — FINAL HUD RECOVERY: AUTHORITATIVE FINALE QUALIFICATION

## Mission

Fix the ONE remaining Codex blocker from the Futuristic Game Moments / HUD Effects mission.

Do not redesign unrelated systems.
Do not touch badge assets.
Do not redo the HUD architecture.

## Confirmed Problem

app/events/[slug]/drawing/page.tsx currently determines the current player's finale qualification using public display-label matching such as:

e.playerPublicLabel === currentPlayer.displayName

and:

e.playerPublicLabel.includes(currentPlayer.id.slice(0, 4))

This is NOT authoritative.

Problems:
- display names can collide
- localStorage identity can be stale/untrusted
- public labels are not guaranteed to map uniquely to authenticated player IDs
- the UI can potentially show another player's ticket range as "your qualification"

Codex correctly rejected this.

## Required Fix

Make finale qualification player-specific using trusted authenticated backend identity.

The client must NEVER infer "your tickets" from public labels.

## Required Architecture

Prefer extending the existing drawing API so that when an authenticated player requests drawing data, the server also returns a dedicated current-player qualification object resolved from the authenticated player identity.

Conceptual shape:

currentPlayerQualification:
- qualified: boolean
- entryCount: number
- ticketRange:
  - startTicket
  - endTicket

Names may differ to match existing types.

A dedicated authenticated endpoint is also acceptable if it fits the architecture better.

## Server Requirements

The server must:

1. Resolve authenticated user/session server-side.
2. Resolve the canonical CQ player from that authenticated identity.
3. Use trusted player ID / participant identity.
4. Query authoritative drawing-entry and ticket-range data.
5. Return only that player's personalized qualification data.
6. Never trust client-supplied player ID.
7. Never trust display name for identity.
8. Never trust localStorage identity.
9. Never infer identity from partial UUID strings.
10. Preserve existing public drawing transparency behavior.

## Client Requirements

Update:

app/events/[slug]/drawing/page.tsx

Remove all personalized qualification logic based on:

- display name
- public label matching
- ID substring matching
- localStorage identity heuristics

The "View Your Qualification Ceremony" experience must render ONLY from authenticated backend qualification data.

If unauthenticated:
- do not claim any ticket range belongs to that viewer
- public drawing information may still be displayed normally

If authenticated but not qualified:
- render accurate not-qualified state

If authenticated and qualified:
- display authoritative entry count
- display authoritative ticket range if available

## Security

Do not expose:
- auth UUID publicly
- private DB IDs unnecessarily
- email
- service-role credentials
- internal admin identifiers

Preserve:
- deterministic drawing logic
- public drawing transparency
- prize integrity
- existing RLS/security boundaries
- HUD/finale effects architecture

## Regression Tests

Add tests proving:

1. Two players can share the same display name without personalized ticket misattribution.
2. Display-name/localStorage spoofing cannot alter "your qualification."
3. Authenticated Player A never receives Player B's ticket range.
4. Unauthenticated viewers receive no personalized qualification claim.
5. Qualified authenticated player receives exact authoritative entry count.
6. Qualified authenticated player receives exact authoritative ticket range.
7. Authenticated unqualified player receives correct negative state.
8. Existing public drawing transparency data still works.

## Validation

Run:

npm test
npx tsc --noEmit
npm run lint
npm run build
git diff --check

Fix failures caused by this work.

## Git

When all checks pass:

git add -A
git commit -m "fix(drawing): use authenticated finale qualification"
git push

## Final Report

Report:

1. Exact root cause
2. Endpoint/data-flow change
3. How authenticated player identity is resolved
4. Client heuristic removed
5. Tests added
6. npm test result
7. typecheck result
8. lint result
9. build result
10. git diff --check result
11. commit hash
12. push result

Finish with:

BUILDER_STATUS: COMPLETE

Do not claim COMPLETE unless implementation and validation actually pass.
