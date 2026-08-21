# CANTON QUESTS — PASSWORD ACCOUNTS + STAY LOGGED IN UNTIL EXPLICIT LOGOUT

## Mission

Convert Canton Quests authentication to a normal password-account system.

The current magic-link / email-link flow should NOT be the normal returning login experience anymore.

Desired behavior:

NEW PLAYER
→ callsign + email + password
→ verify email once
→ enter Player Command Center
→ remain logged in

RETURNING PLAYER
→ email + password
→ immediate authenticated session
→ Player Command Center
→ no callsign required
→ no email link required for normal login

FORGOT PASSWORD
→ use the existing scanner-safe email flow
→ verify recovery securely
→ choose new password
→ return to Player Command Center

---

# CRITICAL SESSION REQUIREMENT

Players must stay logged in until they explicitly press LOG OUT.

Do not interpret this as merely surviving refresh or a short return visit.

Required:

- refresh keeps player logged in
- navigation keeps player logged in
- closing browser does NOT intentionally log player out
- reopening browser restores authenticated session when valid
- returning later restores authenticated session when valid
- do not add an automatic logout timer
- do not use session-only cookies that intentionally disappear on browser close
- normal player-controlled session termination is explicit LOG OUT

Security exceptions are acceptable:

- refresh token revoked
- Supabase invalidates session
- password/security change invalidates session
- server-side security revocation

Do not invent permanent custom auth tokens.

Use Supabase secure refresh-token/session persistence correctly.

---

# 1. AUDIT CURRENT AUTH

Inspect:

- signup UI
- login UI
- auth API routes
- app/auth/confirm/page.tsx
- app/api/auth/confirm/route.ts
- lib/supabase-auth.ts
- session endpoint
- logout
- middleware
- profile routing
- recovery/password-reset code
- Supabase client/server helpers
- tests
- auth-related architecture docs

Preserve working scanner-safe verification architecture.

---

# 2. NEW PLAYER SIGNUP

Signup should collect:

- callsign
- email
- password
- confirm password
- starting path where current onboarding requires it

Use Supabase password signup.

Do NOT store passwords in public tables.

Do NOT build custom password hashing.

Passwords belong only to Supabase Auth.

Keep email verification enabled.

After signup:

- send verification email
- preserve callsign/path attribution
- provision/claim player idempotently
- after verification route to Player Command Center

---

# 3. RETURNING LOGIN

Returning login should require ONLY:

- email
- password

Do not require callsign.

Desired UI:

WELCOME BACK

Email
Password

[ ENTER CANTON QUESTS ]

[ FORGOT PASSWORD? ]

Optional:
[ SHOW PASSWORD ]

After successful login:

- identify authenticated Supabase user
- resolve linked player from auth user ID
- restore callsign
- restore avatar/photo
- restore path
- restore XP
- restore badges
- restore quest progress
- restore prize entries
- route to Player Command Center

---

# 4. PLAYER IDENTITY

Once authenticated, use server-side auth identity.

Preferred relationship:

players.user_id = auth.users.id

or the current canonical equivalent.

Do not trust client-submitted:

- callsign
- player ID
- email
- path

to decide which player is authenticated.

---

# 5. EXISTING PLAYERS

Existing players created under magic-link/OTP auth must NOT lose their accounts.

Implement a safe transition.

For an existing player who does not yet have a password:

- they can use FORGOT PASSWORD / SET PASSWORD
- recovery email goes to their existing auth user
- recovery verifies securely
- they choose a password
- SAME auth user remains
- SAME player row remains
- SAME callsign remains
- SAME avatar remains
- SAME path remains
- SAME XP remains
- SAME badges remain
- SAME quest progress remains
- SAME prize entries remain

Do not create duplicate auth users or player rows.

---

# 6. RECOVERY FLOW

Turn the current email-link behavior into account recovery.

Desired:

1. Click FORGOT PASSWORD
2. Enter email
3. Send Supabase recovery email
4. Scanner-safe CQ recovery page loads
5. GET does not consume token
6. deliberate action verifies token_hash with type=recovery
7. recovery session established
8. show SET NEW PASSWORD screen
9. securely update password using Supabase Auth
10. redirect to Player Command Center

Do not use normal magic-link login for returning players.

---

# 7. PRESERVE SCANNER-SAFE EMAIL SECURITY

Do NOT regress the previous fix.

Preserve:

- token_hash
- custom confirmation/recovery page
- deliberate POST verification
- verifyOtp
- open-redirect protection
- safe internal next routing
- secure session handling

DO NOT restore raw:

{{ .ConfirmationURL }}

for signup/recovery templates if scanner-safe templates are already configured.

---

# 8. PASSWORD RESET PAGE

Build a CQ-styled reset page.

Example:

RESTORE PLAYER ACCESS

New Password
Confirm Password

[ SET NEW PASSWORD ]

Requirements:

- minimum sensible password length
- matching validation
- useful errors
- password never logged
- password never written to player database
- no password in query params

After success:

PLAYER ACCESS RESTORED

[ ENTER COMMAND CENTER ]

---

# 9. POST-AUTH ROUTING

Successful login should NOT go to anonymous homepage.

Routing precedence:

complete player
→ Player Command Center / profile

incomplete player
→ required onboarding
→ Player Command Center

Safe explicit internal next routes may be honored where appropriate.

Canonical profile/command-center route should be determined from current code.

Likely:
/profile

Do not rebuild the Player Command Center.

---

# 10. KEEP PLAYERS LOGGED IN

Audit current cookie/session behavior carefully.

Confirm:

- Supabase refresh token persists
- browser restart does not intentionally clear auth
- session can refresh automatically
- server-rendered protected routes recognize player
- canonical domain redirects do not break session
- logout explicitly clears session

Do not add a fake "remember me" checkbox if persistence is always intended.

Persistence should be the default.

---

# 11. LOGOUT

LOG OUT must:

- call correct Supabase signOut flow
- clear auth cookies/session state
- clear browser persistence appropriately
- return player to anonymous state
- prevent private profile access
- remain logged out after browser close/reopen

Explicit logout is the normal player-controlled end of session.

---

# 12. AUTHENTICATED NAVIGATION

When logged in, navigation should clearly show authenticated state.

At minimum:

- player avatar or callsign
- COMMAND CENTER / PROFILE
- QUESTS
- LEADERBOARD
- LOG OUT

Do not show JOIN / SIGN UP as the primary action to logged-in players.

Mobile nav must expose the profile/command center clearly.

---

# 13. HOMEPAGE AUTHENTICATED STATE

If logged-in player visits `/`:

show obvious recognition.

Example:

WELCOME BACK, NIGHTWOLF

[ ENTER COMMAND CENTER ]

Do not render homepage exactly like anonymous visitor.

---

# 14. DOMAIN / COOKIE BEHAVIOR

Audit canonical production host behavior.

Current production may redirect:

divinedesigndestinations.com
→ www.divinedesigndestinations.com

Make session persistence intentional across the canonical host.

Do not allow localhost URLs to appear in production auth redirects.

---

# 15. SUPABASE HOSTED SETTINGS

Verify if tooling permits:

- email/password provider enabled
- email confirmation enabled
- recovery behavior supported
- redirect URLs valid
- site URL correct

If a Supabase Dashboard change is required, report the exact change.

Do not claim full completion if hosted config still blocks password auth.

---

# 16. TESTS

Add/update tests for:

NEW SIGNUP
- callsign + email + password
- verification required
- player provisioning preserved

RETURNING LOGIN
- email + password only
- callsign not required
- correct player restored

PERSISTENCE
- refresh preserves session
- navigation preserves session
- browser-reopen persistence architecture is correct
- server recognizes session

EXISTING PLAYER TRANSITION
- recovery sets password
- no duplicate auth user
- no duplicate player
- progress preserved

RECOVERY
- scanner-safe recovery
- set new password
- return to Command Center

LOGOUT
- session cleared
- private route blocked after logout
- logged-out state survives browser reopen

SECURITY
- external next rejected
- wrong password handled safely
- no plaintext password storage
- player cannot impersonate another account

---

# 17. REAL BROWSER VERIFICATION

Test brand-new player:

1. create account with callsign + email + password
2. receive verification
3. verify once
4. land on Command Center
5. refresh
6. still logged in
7. close browser
8. reopen browser
9. still logged in
10. log out
11. close browser
12. reopen browser
13. remains logged out
14. login with email + password
15. no callsign requested
16. land on Command Center

Test existing pre-password player:

1. use forgot password
2. receive recovery email
3. scanner-safe recovery
4. set password
5. confirm same player profile/progress
6. log out
7. login with email + password
8. confirm same identity restored

Test mobile widths:

320
375
390
414
430

No horizontal overflow.

---

# 18. VERIFICATION

Run:

npm test
npx tsc --noEmit
npm run lint
npm run build
git diff --check

All must pass.

---

# 19. DEPLOYMENT

If all checks pass:

1. commit
2. push main
3. deploy production
4. verify live

Suggested commit:

feat(auth): add persistent password accounts

---

# FINAL REPORT

Report:

1. Old auth architecture
2. New password-account architecture
3. Files changed
4. Signup behavior
5. Returning login behavior
6. Existing-player transition
7. Recovery behavior
8. Session persistence behavior
9. Exact logout behavior
10. Scanner-safe verification status
11. Canonical domain/cookie behavior
12. Command Center routing
13. Hosted Supabase settings
14. Manual action still required, if any
15. Browser verification
16. Browser-close/reopen persistence test
17. Explicit logout persistence test
18. Mobile results
19. Test count
20. Typecheck
21. Lint
22. Build
23. Production deployment
24. Commit hash

The mission succeeds only when:

- new players create password accounts
- email is verified once
- returning players use EMAIL + PASSWORD
- callsign is not required for login
- players stay logged in until explicit LOG OUT, except legitimate security invalidation
- existing players can set passwords without losing progress
- forgot password uses the scanner-safe recovery flow
- successful login enters the personalized Player Command Center.
