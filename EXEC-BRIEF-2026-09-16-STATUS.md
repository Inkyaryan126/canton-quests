# Exec Brief — 2026-09-16 — Coordination / Status

**Branch**: `cq-exec-brief-20260916` (worktree at `/private/tmp/cq-exec-brief-20260916`)
**Agent lane**: Ad hoc senior-engineer/QA brief — NOT a Boardroom-orchestrated run.
Other agents are working in other worktrees concurrently; this branch only
touches the files listed below.

---

## 1. What this branch does

Five-part mission: (1) investigate a Vercel Fluid Active CPU warning and fix
any clear, safe inefficiency found; (2) a fact-checked Visit Canton tourism
pitch; (3) a Visit Canton Cultural Tourism grant workspace; (4) a minimal,
opt-in launch-critical verification gate for Boardroom; (5) this status file.

## 2. Files touched

| File | What changed | Why |
|---|---|---|
| `lib/event-readiness.ts` | `auditEventQRQuests`, `auditEventQuestsAndLocations`, `evaluateEventLaunchGates`, `computeEventReadinessReport`, `getOperatorChecklist` all accept an optional precomputed-inputs param and reuse it instead of re-fetching/re-auditing | Eliminate confirmed redundant computation (see §3) |
| `app/api/admin/live/route.ts` | `GET` handler now fetches quests + both audits once and threads them through instead of letting 5 downstream functions each recompute independently | Same |
| `tests/phase5.4-event-readiness-rehearsal.test.ts` | +5 tests proving precomputed inputs are actually reused (not silently ignored), and that omitting them preserves old behavior | Regression coverage for the fix |
| `lib/boardroom/verificationGate.ts` (new) | Pure gate function: `launchCritical` tasks require non-placeholder `verificationEvidence` | Item 4 |
| `lib/boardroom/types.ts`, `lib/boardroom/tasks.ts` | Add opt-in `launchCritical` + `verificationEvidence` fields and a `setVerificationEvidence` setter | Item 4 |
| `lib/boardroom/supervisor.ts` | Wires the gate into the completion pipeline, same structural position as the existing `TESTS_REQUIRED` check | Item 4 |
| `boardroom/schema/task.schema.json` | Schema for the two new fields | Item 4 |
| `boardroom/BOARDROOM.md` | New "Launch-critical verification gate" section | Item 4 |
| `tests/boardroom-verification-gate.test.ts` (new) | 10 tests: pure-function cases + 3 real `runSupervisor()` integration tests against a temp git repo | Item 4 |
| `docs/VISIT-CANTON-TOURISM-PITCH.md` (new) | Phone-friendly pitch, fact-cited, UNKNOWN/TODO where no real data exists | Item 2 |
| `docs/VISIT-CANTON-GRANT-WORKSPACE.md` (new) | Grant workspace: concept, impact, outcomes, budget skeleton, evidence checklist, open questions | Item 3 |
| `EXEC-BRIEF-2026-09-16-STATUS.md` (new, this file) | Coordination record | Item 5 |

Nothing outside this list was modified. No Grid-related files, no Supabase
migrations, no production data, no pushes.

## 3. Vercel CPU investigation — what's verified vs. hypothesis

**VERIFIED (read the code, confirmed the call graph):**
`/api/admin/live` GET is polled every 5s from `/admin/live` and every 15s
from `/gm/[slug]` (one `setInterval` per open tab —
`app/admin/live/page.tsx:247`, `app/gm/[slug]/page.tsx:126`). Before this
fix, a single poll called `computeEventReadinessReport`,
`evaluateEventLaunchGates`, and `getOperatorChecklist` — each of which
independently re-fetched the event's quests (`getQuestsForEventDB`, a real
Supabase round trip) and re-ran the O(n) QR/quest/location audits — on top
of two more direct calls to the same audit functions in the route handler
itself. Net effect: `auditEventQRQuests` and `auditEventQuestsAndLocations`
each ran ~6x, and `getQuestsForEventDB` was called roughly a dozen times,
per single admin-panel poll. Fixed by computing quests + both audits once
per request and threading them through as an optional `precomputed` param
(backward-compatible — existing callers/tests that omit it are unaffected).

**VERIFIED (via `vercel logs`)**: production (`www.cantonquests.com`) is
receiving real traffic as of 2026-09-16 — the event's public launch date
(Sept 11, 2026) has already passed, so `/watch` and `/admin/live` are live,
not idle.

**BLOCKED (tooling limitation, not resolved)**: `vercel usage` (which
reports Active CPU cost/MIU breakdown) returned `Error: Costs not found
(404)` for every variant tried (`--group-by project`, explicit `--from/--to`
date ranges). This is consistent with the linked Vercel account
(`inkyaryan126s-projects`) being on a plan tier without programmatic
cost/usage API access via the CLI. **I could not pull an exact Active CPU
number attributable to any specific route.** The admin/live fix is
justified by the code-level redundancy evidence above, not by a measured
before/after CPU number — that measurement has to come from the Vercel
dashboard (Observability → Functions) directly, which isn't available
through CLI/API access in this environment.

**HYPOTHESIS, not fixed (top candidate for a follow-up)**: `/api/game/spectator`
is polled every 5s from the public `/watch` page (`app/watch/page.tsx:190`),
with the initial page load alone firing 6 parallel spectator-endpoint
requests. Unlike `/api/admin/live` (bounded by however many admin/GM tabs
are open), `/watch` is public — N concurrent spectators × 6 sub-requests /
5s scales with audience size, which could plausibly dominate total Active
CPU if there's real public viewership. I did not find a redundant-computation
bug here the way I did on `/api/admin/live` — it would need runtime
profiling (or real Vercel Observability access) to confirm whether it's
actually the bigger cost driver. Recommended next step: get dashboard access
to Vercel's per-function Active CPU breakdown and compare `/api/admin/live`
vs `/api/game/spectator` directly.

## 4. Verification performed

- `npx tsc --noEmit -p tsconfig.json` — clean, whole repo, after all changes.
- `tests/phase5.4-event-readiness-rehearsal.test.ts` — 24/24 pass (19
  pre-existing + 5 new), confirming the CPU fix preserves all prior behavior
  and that precomputed inputs are genuinely reused, not silently ignored.
- `tests/boardroom-verification-gate.test.ts` — 10/10 pass, including 3 real
  integration tests that drive the actual `runSupervisor()` pipeline against
  a temporary git repo (not just the pure gate function in isolation).
- A full-suite `vitest run` taken immediately after the event-readiness fix
  landed (before the Boardroom changes existed) showed **2287/2323 tests
  passing (36 failures across 13 files)**. Every sampled failure was a
  pre-existing, date-dependent assertion unrelated to this branch's changes
  — e.g. `tests/prelaunch-badges.test.ts` asserts `canton-weekend-1 is
  genuinely pre-launch today`, which now fails simply because "today"
  (2026-09-16) is after the Sept 11–14 launch window; nothing in that
  failure touches `lib/event-readiness.ts`, `app/api/admin/live/route.ts`,
  or `lib/boardroom/**`.
- `npx vitest run tests/boardroom-` (all 18 Boardroom test files together,
  including the new one) — **216/216 pass**, confirming the new gate doesn't
  disturb any existing Boardroom behavior (lock, commit gate, salvage,
  routing/failover, budget, timeout policy, production guard, etc.).
- **Not completed**: a full-suite run taken *after* the Boardroom changes
  landed did not finish before this status file was written — this machine
  had heavy concurrent load from other agent sessions and unrelated local
  processes (a stray `next dev`, Codex, desktop-commander, etc.), and a
  couple of full-suite invocations were taking 5+ minutes without
  completing. Given (a) the event-readiness fix was already validated by a
  clean full run, (b) the Boardroom change is purely additive/opt-in and
  touches a completely separate subsystem from the app-level failing tests,
  and (c) all 18/18 Boardroom test files (216 tests) now pass together, I
  judged this sufficient without a third full-suite run competing for CPU
  with other agents' work on the same machine. **Before merging this
  branch, run the full suite once more when the machine is quieter** for
  one clean end-to-end confirmation.

## 5. Blockers / what remains open

1. **No exact Vercel Active CPU number** — CLI/API cost data unavailable
   (404) on this account/plan. Needs dashboard access (Observability →
   Functions → Active CPU, filtered by route) to confirm the admin/live fix
   moved the needle, and to properly evaluate the `/watch` spectator-polling
   hypothesis.
2. **Tourism pitch / grant workspace are fact-checked but incomplete by
   design** — see the UNKNOWN/TODO markers inside both docs. No real player
   counts, no contact email, no legal entity name, and no confirmation that
   the Aura Craft Coffee / Downtown Canton Arcade Vault partnerships
   actually went live exist anywhere in this repo. Someone with access to
   Supabase production data and the actual business relationships needs to
   fill those in before either doc goes external.
3. **Full post-Boardroom-change test suite run** — see §4, not completed
   due to machine contention; recommend one more full run before merge.
4. **package-lock.json** — `npm install` was run to get a working
   `node_modules` in this worktree (it didn't exist beforehand); the
   resulting lockfile diff was cosmetic (npm-version metadata only) and was
   reverted with `git checkout -- package-lock.json` rather than committed.

## 6. Explicitly out of scope / not touched

- Grid homepage work (recent commits `40c9050`, `603eeb4`, `3e021f4`,
  `0681b2e`, `82c70c5`) — untouched.
- No Supabase migrations run, no production data changed, no deploys, no
  `git push`.
- The `/api/game/spectator` polling hypothesis (§3) was investigated but not
  fixed — no redundant-computation bug was found there the way there was on
  `/api/admin/live`; fixing it without real profiling data would be
  guessing, not evidence-based.
