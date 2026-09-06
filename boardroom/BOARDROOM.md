# Boardroom V2 — Constitution

Boardroom is the overnight multi-CLI orchestrator that coordinates three real,
locally-installed AI coding CLIs against **this single repository** — no git
worktrees, no clones, no per-agent repo copies:

- **Astra** (`codex`) — Lead Developer. Reserved for experiential architecture,
  cinematic UX systems, major cross-component work, difficult bugs, flagship
  moments, final integration/polish, and hard architectural decisions.
- **Claude** (`claude`, this CLI) — Senior Engineer / QA. Recon, performance
  audits, code review, backend/database work, accessibility validation,
  mundane build fixes, and the authority to reject an Astra implementation
  when a materially cheaper approach exists (`ASTRA IMPLEMENTATION REJECTED`
  — see `lib/boardroom/routing.ts#rejectAstraImplementation`).
- **Agy** (`agy`) — Fast Implementation / Scout. Routine implementation,
  repetitive edits, basic test writing, CSS cleanup, screenshots/inventory,
  copy changes.

This document is the constitution the supervisor's own code implements
(`lib/boardroom/*.ts`) — read it alongside that code, not instead of it.
It is a durable, git-tracked reference; fast-changing runtime state
(the lock, the budget, the task ledger) lives in the gitignored
`.boardroom/runtime/` and is never committed.

## What Boardroom is for right now

Boardroom V2, as built, is **preparatory infrastructure only**. It has not
been used to run the Canton Quests cinematic/technical UX overhaul. Do not
start that overhaul as a side effect of running or testing this system —
it is queued for a future, separately-approved run.

## Honesty rules (non-negotiable)

1. **Astra's usage/quota/reset state is never programmatically readable.**
   Verified against `codex --help`, `codex exec --help`, and
   `codex doctor --help` — no such subcommand exists on any of the three
   CLIs. Allowance is **self-reported only** (`budget.selfReportAllowance`),
   never inferred. A tier (`NORMAL`/`CONSERVE`/`RESERVE`/`CRITICAL`) is only
   ever computed from a real self-report.
2. **Usage-exhaustion detection from captured CLI output is heuristic.**
   `adapters/exhaustionPatterns.ts` pattern-matches known phrasing
   ("usage limit", "rate limit", "quota exceeded", "weekly limit", "429", …).
   This is `HIGH_CONFIDENCE` at best, **never `VERIFIED`** — a real bug
   producing similar wording could be misclassified. The two-failed-attempt
   rule (`attempts.ts`) is the independent second safety net.
3. **A reset credit is never marked used except via an explicit, human-
   confirmed action.** `budget.requestReset()` only ever returns an
   `ACTION REQUIRED` message — it never increments anything. Only
   `budget.confirmResetRedeemed()`, called from a manual
   `npm run boardroom:budget confirm-reset-N` invocation after Dustin has
   actually redeemed the credit himself, can move the counter. Reset #2 can
   never be confirmed before Reset #1.
4. **Confidence states must never silently upgrade.** `VERIFIED` means
   actually tested/measured/executed; `HIGH_CONFIDENCE` means strongly
   supported by inspection but not fully exercised; `ASSUMPTION` requires
   validation; `BLOCKED` means it cannot safely proceed. A result carrying
   one of the weaker states must keep it attached through every downstream
   record (task ledger, handoff doc, morning report) — never quietly
   becomes "done".

## Boardroom owns every commit

Agents edit files while holding the write lease. **They never run `git add`
or `git commit` themselves** — the prompt built by `supervisor.ts` says so
explicitly. The authoritative sequence, matched exactly in
`lib/boardroom/supervisor.ts`:

1. Agent runs; result captured.
2. Actual changed paths inspected (`git status --short`).
3. `commitGate.evaluateChangedPaths(WRITE_SCOPE, actualPaths)` — **before**
   any test run. Anything outside `WRITE_SCOPE` → `BLOCK` immediately, no
   test run wasted, nothing staged, nothing swept in with `git add -A`
   (never used, anywhere in this system).
4. Only on a clean `COMMIT` decision does `TESTS_REQUIRED` validation run.
5. Validation failure → recorded as a failed attempt; still no commit.
6. Validation success → stage the exact approved paths only, Boardroom
   creates the commit, the resulting real hash is written into the task's
   `currentCommit`.
7. The write lock is held continuously from before the agent runs through
   the commit — never released in the gap between an agent's edits and the
   checkpoint landing.

## Production safety (`lib/boardroom/productionGuard.ts`, `.githooks/pre-push`)

Boardroom may edit locally, test, build, and commit to the overnight branch.
It **never**: pushes to `origin main`/`master`, runs a production database
migration, or deploys. `.githooks/pre-push` is a real, working git hook
(activate with `git config core.hooksPath .githooks`) that blocks a push to
a protected branch while `.boardroom/runtime/AUTONOMOUS_RUN_ACTIVE` exists —
this is enforced by git itself, not just documented here. Morning approval —
reviewing the overnight branch and deciding whether to merge/push — belongs
to Dustin.

## Overnight branch

Every autonomous run creates a fresh, unique
`boardroom/astra-overnight-<runId>` branch from a verified clean base
commit (`lib/boardroom/preflight.ts#bootstrap`) — never the bare fixed name,
never reusing or resetting a prior run's branch. No agent task executes and
no autonomous commit happens until the bootstrap sequence has verifiably
succeeded (clean tree → base commit recorded → branch created → checkout
verified).

## Real limitations, disclosed plainly

1. Astra reset-credit redemption is 100% manual, always — see honesty rule 3.
2. Usage-exhaustion detection is heuristic, not guaranteed — see honesty
   rule 2.
3. The write lock only governs invocations that go through the supervisor.
   It cannot stop a hand-driven fourth terminal from editing the repo while
   an autonomous run is active — don't hand-drive a CLI against this repo
   while `boardroom:start` is running.
4. A hung process needs a timeout to end — none of the three CLIs self-report
   "I'm stuck". `lib/boardroom/runner.ts` enforces a per-task timeout
   (SIGTERM, then SIGKILL after a 5s grace period), which is a heuristic
   ceiling, not the CLI announcing completion.

## Performance veto (applies once the UX overhaul actually starts)

Prefer CSS/SVG/native browser APIs over JS libraries for cosmetic effects.
No Three.js, particle engines, or animation frameworks for effects
achievable with CSS. Respect `prefers-reduced-motion`. Cosmetic JS budget:
roughly 50KB gzip. Any agent may flag a performance veto against another
agent's proposed approach; Claude is explicitly empowered to reject an
Astra implementation on these grounds (`routing.ts#rejectAstraImplementation`).

## Six-phase system (for the eventual UX work — not started by this system)

`PHASE_1_RECON → PHASE_2_CORE_EXPERIENCE_SYSTEM → PHASE_3_FLAGSHIP_MOMENTS →
PHASE_4_SECONDARY_POLISH → PHASE_5_PERFORMANCE_ACCESSIBILITY →
PHASE_6_ASTRA_FINAL_PASS`. `PHASE_6` is where the ~25-30% Astra allowance
reserve (`budget.ts`, `protectedFinalIntegration`) is spent.

## Stop conditions

The supervisor loop (`lib/boardroom/supervisor.ts#runSupervisor`) stops on:
no more ready/queued tasks; all three agents unavailable this run; a task
forced into `BLOCKED` by the two-failed-attempt rule with no further
progress possible; external lock contention (another live process holds the
write lock); a failed bootstrap step; or the iteration safety ceiling. Every
stop reason is recorded verbatim in the morning report — never silently
swallowed.

See also: `boardroom/ROLES.md`, `boardroom/schema/task.schema.json`,
`lib/boardroom/*.ts`, `tests/boardroom-*.test.ts`.
