# The Grid Builder OS — Design

## Purpose

Builder OS is a local control plane for creating The Grid. It turns the existing multi-agent development machinery into a visual operator experience that a nontechnical person can understand without reading terminal output, Git state, or internal orchestration vocabulary.

The control plane does not replace Control Tower, the Master Board, Product Director, Playable Loop Score, Definition-of-Done Gate, or Merge Conveyor. It composes those systems and translates their evidence into plain language.

## Product experience

The primary screen lives at `/admin/grid-builder` while the Next.js app is running locally on the development Mac.

The operator should immediately understand five things:

1. How much of The Grid is already integrated.
2. Whether the playable player loop is healthy.
3. Which builders are currently working and what each one is doing.
4. What the system thinks should be built next.
5. Whether a human decision is actually required.

The primary action is **BUILD THE GRID**. The button starts one bounded orchestration cycle and returns immediately. The screen polls status so the operator can watch the crew work without managing terminal windows.

## Source of truth

Builder OS must not invent a second planning system.

Its read model is derived from:

- Grid Master Board for milestone state.
- Playable Loop Score for player-loop readiness.
- Product Director for the next safe work shortlist.
- Control Tower claims and worktrees for current workers and coordination warnings.
- Canonical integration Git history for recent progress.
- Builder OS run state stored in Git-common coordination storage.

A milestone counts as completed on the visual progress meter only when the Master Board reports `INTEGRATED`. `READY_TO_INTEGRATE` is shown separately as ready to combine.

## Local-only control boundary

The status UI may be visible wherever the local app is reachable, but the action endpoint refuses to start development agents unless all of the following are true:

- the request hostname is localhost, 127.0.0.1, or ::1;
- `NODE_ENV` is not production;
- the authenticated Game Master session is valid;
- Control Tower reports no coordination warnings;
- no other Builder OS cycle is already running.

The API exposes an allowlisted `start-cycle` action only. It never accepts a shell command, branch name, path, prompt, or arbitrary executable from the browser.

## Orchestration cycle

Each button press launches a detached one-shot runner. The runner:

1. Persists a run ID, PID, state, timestamps, and log path in Git-common coordination storage.
2. Creates a temporary detached supervisor worktree from the canonical integration ref, so the lead never receives the canonical checkout itself as writable implementation space.
3. Starts a single lead supervisor process inside that isolated worktree.
4. The lead inspects current claims and canonical state before assigning new work.
5. Existing ready/claimed work is harvested before new lanes are created.
6. New worker work uses isolated worktrees, explicit Control Tower claims, and exact scopes.
7. Completed lanes go through focused verification and the existing Definition-of-Done / Merge Conveyor path.
8. The cycle stops after safe work is harvested/assigned or a real human blocker is reached.

Codex is the preferred lead. If the installed Codex CLI cannot start successfully, the runner records the failure and falls back to Claude. Worker specialization can use Claude or Agy as appropriate.

## Safety invariants

Builder OS may orchestrate local isolated development and may request canonical integration through the existing guarded merge process.

Builder OS must never:

- directly edit the canonical integration checkout as worker implementation space;
- push or merge to `main` / `master`;
- deploy;
- execute production database changes;
- bypass CLI sandbox/permission safeguards;
- accept arbitrary shell input from the browser;
- silently convert unverified work into completed progress.

Production promotion remains an explicit release activity outside Builder OS.

## Human language translation

Internal state should be translated rather than exposed raw:

- claimed lane → Builder working
- no dirty files / no process → At checkpoint
- stale claim → Needs attention
- ready to integrate → Ready to combine
- integrated → Built / combined
- coordination issue → Needs you

Technical evidence remains available indirectly through recent activity and timestamps, but the main screen optimizes for comprehension rather than Git terminology.

## Run state and failure handling

Run state values are:

- `idle`: ready for a new cycle;
- `working`: a runner PID is alive;
- `finished`: the last cycle exited successfully;
- `needs_attention`: the last cycle failed, timed out, or vanished unexpectedly.

A stale `working` record whose PID is no longer alive is converted to `needs_attention` when read.

The initial implementation uses a bounded lead-process timeout and command failure as health signals. A later iteration can add explicit lightweight health probes and per-worker visual logs without changing the local-only security model.

