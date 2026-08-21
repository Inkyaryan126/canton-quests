# CANTON QUESTS — REPAIR AUTH SESSION CONSISTENCY BETWEEN LOGIN AND PLAYER COMMAND CENTER

## Mission

Fix the production authentication bug where a player successfully logs in, `/api/auth/me` returns 200, but `/api/player/command-center` immediately returns 401 Unauthorized and the UI shows:

"Authentication required. Please log in to Canton Quests."

This is a focused production repair mission.

Do NOT redesign the entire auth system again.

Do NOT replace the new password-account architecture.

Do NOT regress the new persistent-login requirement.

The goal is to make all authenticated player routes recognize the SAME canonical Supabase session.

---

# PRODUCTION EVIDENCE

Current production deployment:

dpl_2uMnr2rX3dh5AhHYdB4dWkMx6FC7

Current production commit:

ca91f047529905ee97e7497e72447adde7a62d8e

Observed live behavior:

POST /api/auth/login
→ 200

GET /api/auth/me
→ 200

GET /api/player/command-center
→ 401

Observed multiple times in production.

Therefore:

- credentials are being accepted
- some auth/session state is being established
- /api/auth/me can recognize the session
- /api/player/command-center is NOT recognizing the same session

The repair must identify and eliminate that inconsistency.

---

# 1. AUDIT AUTH RESOLUTION PATHS

Inspect and compare the exact authentication logic used by:

- app/api/auth/login/route.ts
- app/api/auth/me/route.ts
- app/api/player/command-center/route.ts
- app/api/player/profile/route.ts
- any player/private APIs
- lib/supabase-auth.ts
- Supabase server client helpers
- middleware
- cookie/session utilities
- logout route
- profile page
- command center page
- any legacy CQ session helpers

Find out exactly why `/api/auth/me` accepts the current player but `/api/player/command-center` rejects them.

Do not guess.

Trace the cookie/session from login response through the next request.

---

# 2. ESTABLISH ONE CANONICAL AUTH RESOLVER

There must be ONE canonical server-side way to determine the current authenticated player.

Preferred model:

1. read Supabase auth session from request cookies
2. validate/refresh session securely
3. obtain authenticated `auth.users.id`
4. resolve `public.players` from `players.user_id = auth.users.id`
5. return canonical player identity

Do not authenticate player APIs using:

- callsign
- email from client
- query parameters
- localStorage
- client-submitted player ID
- old custom session cookie if it has been superseded

If legacy helpers still exist, either remove them from private player routes or route them through the canonical Supabase session resolver.

---

# 3. FIX COMMAND CENTER AUTH

`GET /api/player/command-center` must accept the same authenticated session recognized by `/api/auth/me`.

On successful login:

POST /api/auth/login
→ establishes persistent Supabase session

then:

GET /api/auth/me
→ 200 authenticated

then:

GET /api/player/command-center
→ MUST also return 200

No additional login step.

No callsign re-entry.

No magic link.

No separate CQ auth token.

No duplicated session mechanism.

---

# 4. FIX ALL PRIVATE PLAYER ROUTES CONSISTENTLY

Audit all player-authenticated APIs and pages for similar divergence.

At minimum inspect:

- /api/player/command-center
- /api/player/profile
- profile-image upload route
- private badge/featured badge routes if any
- quest submission APIs requiring player identity
- prize/drawing APIs requiring authenticated player
- authenticated profile page
- player command center page

All private player routes must resolve identity from the same authenticated Supabase user.

Do not leave one route on old auth and another on new auth.

---

# 5. COOKIE / SESSION PROPAGATION

Inspect actual cookie behavior after login.

Verify:

- login response writes all required Supabase cookies
- Set-Cookie values are preserved
- cookies are available on subsequent server routes
- www/non-www canonical redirect does not drop cookies
- cookie path is correct
- cookie domain is correct
- SameSite behavior is correct
- Secure behavior is correct in production
- refresh token cookie persists
- access-token/session refresh works
- browser restart persistence remains supported
- no session-only cookie accidentally replaces persistent cookie

Do not invent custom permanent tokens.

---

# 6. REQUEST-SCOPED SUPABASE CLIENT

Confirm server routes are not accidentally using a Supabase client that:

- does not receive request cookies
- has stale cookies
- mutates cookies incorrectly
- uses browser storage on server
- creates a new unauthenticated client
- cannot refresh auth state

Private routes should use a request-scoped server Supabase client with correct cookie get/set handling.

---

# 7. REMOVE LEGACY AUTH CONFLICTS

Search for old CQ auth/session logic such as:

- custom `cq_session`
- player session cookies
- magic-link-specific session helpers
- old email/callsign auth resolvers
- localStorage session tokens
- duplicate bearer token systems

Do not remove something blindly if still needed for compatibility.

But private player routes must not require an obsolete session in addition to the current Supabase password session.

---

# 8. PRESERVE PERSISTENT LOGIN REQUIREMENT

The previously implemented product requirement remains:

Players stay logged in until they explicitly press LOG OUT, except legitimate security invalidation.

Do not fix this bug by making sessions shorter.

Do not force re-login after refresh/browser restart.

Do not add temporary one-request sessions.

Do not revert to magic-link login.

---

# 9. PRESERVE RECOVERY FLOW

Do not break:

- scanner-safe recovery
- token_hash verification
- deliberate recovery confirmation
- password reset
- existing-account password transition

Recovery is separate from normal login.

---

# 10. PROFILE / COMMAND CENTER DATA

After authentication succeeds, command center must resolve the existing player row and preserve:

- callsign
- avatar/photo
- path
- district
- XP
- rank
- badges
- quest progress
- prize entries
- member since
- privacy settings
- Commander’s Next Move

Do not create a new player row.

Do not duplicate the auth user.

---

# 11. TESTS

Add regression tests specifically for this production bug.

Required sequence:

A. successful password login
B. response establishes session
C. `/api/auth/me` returns authenticated player
D. SAME session cookies used against `/api/player/command-center`
E. command center returns 200
F. correct existing player is returned

Also test:

- anonymous command-center request → 401
- wrong/expired session → 401
- profile route recognizes same session
- private player routes use canonical resolver
- refresh token/session refresh path works
- logout clears session
- after logout command-center returns 401
- no localStorage auth dependency
- no client-controlled player impersonation

---

# 12. PRODUCTION-STYLE COOKIE TEST

If possible, test with the canonical production host behavior:

https://divinedesigndestinations.com
→ https://www.divinedesigndestinations.com

Confirm authentication survives that canonicalization.

---

# 13. REAL BROWSER VERIFICATION

Use real Chrome against production after deployment.

Exact required flow:

1. Open production site
2. Log out fully
3. Login with existing email + password
4. Confirm login response succeeds
5. Confirm player is redirected to Command Center/Profile
6. Confirm no "Authentication required" error
7. Confirm player data loads
8. Refresh page
9. Still authenticated
10. Navigate to quests
11. Navigate back to profile
12. Still authenticated
13. Close browser
14. Reopen browser
15. Still authenticated
16. Press LOG OUT
17. Confirm private command-center access now fails
18. Reopen browser
19. Confirm still logged out

Mobile widths:

320
375
390
414
430

---

# 14. PRODUCTION LOG VERIFICATION

After deployment, inspect production logs.

Required:

POST /api/auth/login
→ 200

GET /api/auth/me
→ 200

GET /api/player/command-center
→ 200

There must be no immediate 401 from command-center for the same authenticated browser session.

---

# 15. VERIFICATION SUITE

Run:

npm test
npx tsc --noEmit
npm run lint
npm run build
git diff --check

All must pass.

---

# 16. COMMIT / PUSH / DEPLOY

If all verification passes:

1. commit
2. push main
3. deploy production explicitly with Vercel CLI if Git auto-deploy is still unreliable
4. verify deployment alias includes:
   - divinedesigndestinations.com
   - www.divinedesigndestinations.com
   - canton-quests.vercel.app

Suggested commit:

fix(auth): unify player APIs on canonical Supabase session

---

# FINAL REPORT

Report:

1. Exact root cause
2. Why /api/auth/me returned 200 while /api/player/command-center returned 401
3. Canonical auth resolver used
4. Legacy auth conflicts removed/fixed
5. Cookie/session issue found
6. Files changed
7. Private routes audited
8. Command center result
9. Profile result
10. Persistent login status
11. Logout status
12. Recovery flow status
13. Tests added
14. Total test count
15. Typecheck
16. Lint
17. Build
18. Browser verification
19. Production log verification
20. Deployment ID
21. Production commit hash
22. Domain aliases verified

The mission is complete only when a real production login produces this sequence:

POST /api/auth/login → 200
GET /api/auth/me → 200
GET /api/player/command-center → 200

and the player remains logged in until explicit logout.
