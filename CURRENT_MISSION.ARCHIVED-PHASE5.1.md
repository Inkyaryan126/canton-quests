# CANTON QUESTS — PHASE 5.1 FINAL MINOR-SAFETY REMEDIATION

## GOAL

Finish Phase 5.1 by correcting the remaining spectator minor-status persistence bug identified by Codex.

Do NOT redesign the spectator system.
Do NOT start Phase 5.2.
Do NOT add unrelated features.

Inspect the current implementation, especially:

- lib/spectator-db.ts
- lib/spectator-engine.ts
- app/api/game/spectator/route.ts
- supabase/migrations/20260809400000_phase5_spectator_engine.sql
- spectator tests
- HANDOFF.md

## REQUIRED FIX 1 — MINOR STATUS MUST BE STICKY

Once a spectator session has:

is_minor = true

ordinary spectator registration/session-refresh calls must NEVER downgrade it to:

is_minor = false

A client omission of isMinor must not mean false.

A client explicitly sending false must not be permitted to clear an already-true minor state through the ordinary public spectator flow.

Use a monotonic rule equivalent in behavior to:

existing_is_minor OR incoming_is_minor

unless there is some future separately authorized admin-only correction path.

Do not create that correction path unless necessary for this mission.

## REQUIRED FIX 2 — TYPESCRIPT WRAPPER

In lib/spectator-db.ts, do not convert an omitted:

isMinor

into an authoritative false value merely because of:

params.isMinor || false

Preserve omitted/undefined semantics where appropriate.

Ensure the database function receives enough information to distinguish:

- new session, no minor indication
- new session, minor=true
- existing minor session refreshed with omitted flag
- existing minor session refreshed with false flag

None of the latter two may clear true.

## REQUIRED FIX 3 — DATABASE FUNCTION

Correct:

register_or_update_spectator_session

so an already-true is_minor value cannot be downgraded through normal session registration/update.

The database must enforce this safety property.

Do not rely only on TypeScript.

Review the current:

INSERT ... ON CONFLICT ... DO UPDATE

logic carefully.

The resulting behavior must guarantee that:

TRUE + omitted => TRUE
TRUE + FALSE => TRUE
TRUE + TRUE => TRUE
FALSE + TRUE => TRUE

For a brand-new session, use the safest sensible default supported by the existing architecture.

## REQUIRED FIX 4 — TEST THE EXACT REGRESSION

Add meaningful regression coverage.

At minimum test:

1. Register spectator as minor.
2. Register/refresh same spectator again with isMinor omitted.
3. Assert spectator remains minor.

Also test:

1. Register spectator as minor.
2. Attempt ordinary refresh with isMinor=false.
3. Assert spectator remains minor.

Where practical, verify both:

- TypeScript/server behavior
- migration SQL/database invariant representation

Do not write a fake string-only test and claim full runtime database coverage.

Be explicit about what is and is not actually runtime-tested.

## REQUIRED FIX 5 — SECURITY REGRESSION CHECK

Reconfirm that fixing minor persistence does not break:

- spectator session registration
- spectator voting
- duplicate vote protection
- cross-event option protection
- public sanitization
- anonymous RLS restrictions
- admin authorization
- spectator-to-player compatibility

## REQUIRED FIX 6 — HANDOFF ACCURACY

Update HANDOFF.md only with evidence actually reproduced.

Do not claim test totals from memory.

The Boardroom final verification suite will independently run in the writable project environment.

## ACCEPTANCE CRITERIA

Do not declare complete until:

- existing minor=true cannot be cleared by omitted isMinor
- existing minor=true cannot be cleared by false through ordinary public refresh
- TS wrapper no longer incorrectly coerces omission into false authority
- database itself enforces sticky minor state
- regression tests exist
- git diff --check passes
- npm test passes
- npm run lint passes
- npm run build passes
- no production deployment occurs
- no production migration is applied
- no unrelated Phase 5.2 work is started

## CODEX REVIEW REQUIREMENT

Codex must specifically inspect the exact previous bug.

If a minor session can still be downgraded through any normal spectator registration/update path:

VERDICT: FIX_REQUIRED

If the bug is genuinely fixed, regression coverage exists, no security regression is introduced, and the Phase 5.1 implementation is otherwise sound:

VERDICT: PASS

## EXPECTED NEXT MISSION

After verified completion:

CANTON QUESTS — PHASE 5.2 PUBLIC /WATCH EXPERIENCE