# The Grid Builder OS — Implementation Plan

## Checkpoint 1 — usable local control plane

- Build a derived Builder OS snapshot using the existing Master Board, Playable Loop Score, Product Director, Control Tower, and canonical Git history.
- Store Builder OS runtime state outside tracked worktrees in Git-common coordination storage.
- Add an authenticated status API.
- Add an authenticated, local-development-only `start-cycle` API with no arbitrary command input.
- Add a one-shot runner with Codex lead and Claude fallback.
- Give the lead a bounded orchestration contract that preserves isolated worktrees, Control Tower claims, Definition-of-Done, and Merge Conveyor safety.
- Build the `/admin/grid-builder` visual control surface with a large BUILD THE GRID action, progress, worker cards, recommendations, needs-you state, process explanation, and recent progress.
- Add focused unit tests for progress semantics, state translation, local action guards, state persistence, and canonical-ref selection.
- Record the local control-plane / no-production-promotion architecture decision.

## Verification

Run in this order so the older development Mac never receives duplicate heavy verification jobs:

1. `npx vitest run tests/grid-builder-os.test.ts`
2. read-only Builder OS status CLI against the live repository
3. `git diff --check`
4. one lint run
5. one TypeScript check
6. one unit-test suite run
7. local browser verification of desktop and narrow/mobile layouts

Do not run duplicate TypeScript checks or builds concurrently.

## Follow-up opportunities

After the first checkpoint is stable:

- add explicit preflight health probes for Codex / Claude / Agy before dispatch;
- show a sanitized live activity stream from the Builder OS coordination log;
- add a guarded Stop After Checkpoint control;
- add a dedicated visual “Ready to combine” queue powered by Definition-of-Done;
- add browser regression screenshots for Builder OS itself;
- provide a small local launcher so Dustin can open Builder OS without remembering an npm command.

These are follow-ups, not prerequisites for the first safe visual control plane.

