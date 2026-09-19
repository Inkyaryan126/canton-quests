# Grid Browser Runtime Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only real-browser harness that verifies the integrated signed-out Grid player journey and emits deterministic structured evidence.

**Architecture:** Reuse the existing local Next child-process pattern from `player-entry-runtime.ts`, but run one server and one Playwright browser session. Keep browser evidence collection and report evaluation pure/testable, and isolate process termination behind a small cleanup helper.

**Tech Stack:** TypeScript, Next.js dev server, Node child processes, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-grid-browser-runtime-verification-design.md`

## Global Constraints

- Read-only toward production; never deploy, navigate to production, write Supabase, or alter repository env/config.
- Use an already-installed Playwright browser or local Google Chrome/Chromium; never download browsers.
- Use only loopback and an ephemeral/free local port.
- Do not fake authentication or mutate player data.
- Fail closed on real browser/page failures; report unavailable prerequisites as `SKIPPED`.
- Tests are focused only; do not run full tsc, full lint, full repository tests, or build.

## Review Focus

- Missing Playwright/Chrome executable must be `SKIPPED`, not `VERIFIED`.
- A real page console/page error or Next error overlay must fail evaluation.
- Redirects must be judged by the final browser URL and expected route evidence, not source text.
- SIGTERM timeout must fall back to SIGKILL and always resolve cleanup.
- Mobile viewport and timestamps must be present in every collected case.

---

### Task 1: Report contracts and pure evidence logic

**Files:**
- Create: `tests/grid-browser-runtime.test.ts`
- Create: `lib/grid/ops/browser-runtime-verification.ts`

**Interfaces:**
- `collectGridBrowserRuntimeEvidence(page, target, context)` collects one case from a Playwright-like page.
- `evaluateGridBrowserRuntimeReport(report)` returns `VERIFIED`, `FAILED`, or `SKIPPED` with reasons.
- `stopGridRuntimeProcess(processLike, timeoutMs)` performs bounded SIGTERM/SIGKILL cleanup.

- [ ] **Step 1: Write failing tests** for successful/failed evidence evaluation, collector error capture, and SIGKILL fallback with a fake process.
- [ ] **Step 2: Run `npm test -- tests/grid-browser-runtime.test.ts` and confirm failure because the harness module is absent.
- [ ] **Step 3: Implement the minimal typed report, collector, evaluator, and cleanup helper.
- [ ] **Step 4: Run the focused test and confirm it passes.

### Task 2: Real local server and browser journey

**Files:**
- Modify: `lib/grid/ops/browser-runtime-verification.ts`

**Interfaces:**
- `verifyGridBrowserRuntime(options)` starts the local server, selects an installed browser without downloading, navigates the three specified cases at `390x844`, and always closes browser/server resources.

- [ ] **Step 1: Add tests for skipped prerequisite evaluation and required-case failure evaluation.
- [ ] **Step 2: Run the focused test and confirm the new tests fail before orchestration exists.
- [ ] **Step 3: Add loopback port reservation, Next child startup/readiness polling, local-only environment sanitization, browser executable selection, browser event listeners, navigation, and `finally` cleanup.
- [ ] **Step 4: Run the focused test and confirm all tests pass.

### Task 3: CLI and documentation completion

**Files:**
- Create: `scripts/grid-browser-runtime.ts`
- Modify: `tests/grid-browser-runtime.test.ts` only if CLI formatting helpers are exported/testable.

**Interfaces:**
- CLI calls `verifyGridBrowserRuntime({ cwd: process.cwd() })`, prints concise human output by default, prints the complete structured report with `--json`, and exits nonzero for `FAILED` or `SKIPPED`.

- [ ] **Step 1: Add a focused test for JSON-safe report shape/CLI status formatting if needed.
- [ ] **Step 2: Run the focused test and confirm it fails before the CLI exists.
- [ ] **Step 3: Implement human and JSON output without adding a package/config file outside scope.
- [ ] **Step 4: Run `npm test -- tests/grid-browser-runtime.test.ts`.
- [ ] **Step 5: Run `git diff --check` and inspect the exact five-file scope.

### Task 4: Final focused verification and handoff

- [ ] Run only `npm test -- tests/grid-browser-runtime.test.ts` and any direct CLI smoke check that does not require browser download or production access.
- [ ] Confirm no screenshots/temp artifacts are tracked.
- [ ] Commit the five-file scoped change and push this branch; do not merge canonical.
