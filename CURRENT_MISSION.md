# CANTON QUESTS — FUTURISTIC GAME MOMENTS / HUD EFFECTS SYSTEM (FINALE QUALIFICATION REMEDIATION)

## Mission

Remediate the drawing page's finale qualification ceremony so that player qualification is strictly server-authoritative and resolved by trusted authenticated identity, eliminating any client-side `displayName` or partial-ID matching against public projection lists.

## Core Requirements Addressed

1. **Server-Authoritative Drawing Qualification**:
   - Replaced client-side public projection matching in `app/events/[slug]/drawing/page.tsx` with server-resolved `authenticatedPlayerQualification`.
   - Exposed `getAuthenticatedPlayerDrawingQualification` in `lib/game-engine.ts` and `getAuthenticatedPlayerDrawingQualificationDB` in `lib/supabase-db.ts`.
   - Updated `GET /api/game/events/[slug]/drawing` to authenticate requests and include `authenticatedPlayerQualification`.

2. **Eliminated Client-Side Guessing**:
   - Removed `displayName` and `id.slice(0, 4)` matching against public drawing lists.
   - Guaranteed duplicate display names or stale local sessions cannot misattribute another player's tickets or qualification ceremony.

3. **Strict Test & Validation Suite**:
   - Added tests proving duplicate display names cannot cross-contaminate qualification data.
   - Added tests proving locked ledger ticket ranges map directly to the player's canonical snapshot assignment.
   - Verified that `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `git diff --check` all pass.

# CRITICAL SESSION REQUIREMENT — STAY LOGGED IN UNTIL EXPLICIT LOGOUT

Clarification from product owner:

Players should remain logged in by default UNTIL THEY EXPLICITLY PRESS LOG OUT.

Do not interpret this as merely:
- survive refresh
- survive browser close
- survive a short return visit
- temporary remember-me behavior

Required behavior:

1. After successful authentication, persist the Supabase session using the normal secure refresh-token/session mechanism.
2. Closing the browser must NOT intentionally log the player out.
3. Reopening the browser must restore the authenticated session automatically when valid.
4. Returning days later must restore the authenticated session automatically when the Supabase refresh session is still valid.
5. Page refresh must preserve auth.
6. Navigation must preserve auth.
7. Do not add an automatic logout timer.
8. Do not use session-only cookies that intentionally disappear when the browser closes.
9. Do not require the player to re-enter email/password on every new browser launch while a valid persistent session exists.
10. The normal player-controlled way to end the session is an explicit LOG OUT action.

LOG OUT must:
- call the correct Supabase sign-out flow
- clear CQ auth cookies/session state
- clear browser auth persistence as appropriate
- return the player to anonymous state
- prevent access to authenticated private routes afterward

Security exceptions are allowed:
- explicit server-side revocation
- invalid/expired refresh token
- credential/security reset that invalidates sessions
- Supabase security enforcement

Do NOT weaken security by inventing permanent custom tokens.

Use Supabase's secure persistent refresh-token architecture correctly.

Verification must include:

A. Login successfully
B. Close browser
C. Reopen browser
D. Confirm still logged in
E. Return to site again
F. Confirm still logged in
G. Refresh repeatedly
H. Confirm still logged in
I. Press LOG OUT
J. Close/reopen browser
K. Confirm player remains logged out

The mission is NOT complete unless this exact persistence behavior is proven.
