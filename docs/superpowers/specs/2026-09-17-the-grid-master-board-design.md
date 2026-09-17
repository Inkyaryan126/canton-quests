# The Grid Master Board — V1 Design

**Date:** 2026-09-17  
**Status:** Proposed design approved in chat; implementation not started  
**Scope:** Additive, read-only coordination visibility for The Grid  
**Safety rule:** V1 must not change existing Control Tower or Boardroom behavior.

## Problem

The repository already has several trustworthy sources of development state, but no single view answers the practical question: **what is complete, what is being built, what is ready to integrate, what is blocked, and what is still left?**

Today that information is split across:

- Grid Agent Control claims for live ownership;
- Git branches, worktrees, commits, and ancestry for completed code;
- Boardroom runtime tasks for durable supervised task state;
- design/spec/acceptance documents for planned and accepted systems;
- production branches for what has actually been promoted.

A human or agent can reconstruct the truth, but doing so repeatedly is slow and error-prone. In particular, a feature can be fully built on a side branch yet still be absent from the integration line. Calling both states simply “done” is misleading.

## V1 Goal

Create one generated **Grid Master Board** that derives status from existing sources instead of asking every agent to edit a shared checklist.

The first version is observational only. It will not claim lanes, release claims, alter Boardroom tasks, merge branches, modify worktrees, fetch remotes, deploy, or mutate production state.
## Existing Sources of Truth

V1 reads these sources directly rather than parsing human prose:

1. **Grid Agent Control**
   - live claims from `.git/grid-agent-control/claims/*.json`;
   - lane, owner, goal, scope, branch, worktree, heartbeat;
   - stale-claim detection through existing agent-control helpers.
2. **Git**
   - local branch refs;
   - worktree paths and cleanliness;
   - commit ancestry relative to the designated Grid integration branch and local/main refs;
   - recent commit subjects used as evidence for known milestones.
3. **Boardroom**
   - current runtime task counts;
   - active/queued/blocked task summaries;
   - autonomous-run state.
4. **A checked-in Grid milestone catalog**
   - stable IDs and human-readable names;
   - known lane names / branch prefixes / commit evidence patterns;
   - dependencies and broad phase grouping;
   - no manually maintained “done” checkbox.

The milestone catalog is the only new durable inventory. Runtime status is always derived.

## Source Precedence

When sources disagree, the board favors stronger evidence:

`integrated Git ancestry` > `active live claim` > `clean completed branch evidence` > `Boardroom blocked/planned state` > `catalog-only planned state`.

The board must surface conflicting evidence instead of silently choosing a flattering status.
## Status Model

Each milestone receives one primary development state:

- **INTEGRATED** — required evidence is present on the designated Grid integration line.
- **READY_TO_INTEGRATE** — feature evidence exists on a clean side branch/worktree, no live claim owns it, and it is not yet on the integration line.
- **IN_PROGRESS** — an active non-stale Control Tower claim maps to the milestone.
- **BLOCKED** — a mapped Boardroom task or explicit dependency is blocked, with the reason surfaced.
- **PLANNED** — milestone exists in the catalog but no implementation evidence is present.
- **UNKNOWN** — evidence is contradictory or insufficient for a safe classification.

`READY_TO_INTEGRATE` is intentionally distinct from `INTEGRATED`. This directly prevents completed parallel work from disappearing into forgotten branches.

A separate promotion axis reports how far the milestone evidence has been promoted:

- **SIDE_BRANCH_ONLY**
- **GRID_INTEGRATION**
- **LOCAL_MAIN**
- **ORIGIN_MAIN** when that ref is available locally
- **DEPLOYMENT_UNKNOWN** unless explicit deployment evidence exists

V1 must never infer a production deployment merely because a commit is on `main`.

## Milestone Catalog

The catalog should cover the major Grid build, not every tiny commit. Initial areas include city compiler/geography, economy, roads, contests, onboarding, world/map, market, auctions, alliances, chat, progression, mobile platform, Scrimmage, takeover persistence, return experience, dynamic events, NPC systems, Surge, City Power/Dominance Heat, admin/GM operations, launch QA, Grid Passport, location-enhanced play, anti-cheat/fraud, season conclusion/archive, and production activation.

Each entry has a stable ID so future tooling can reference it without relying on display names.
A catalog entry should contain only durable matching metadata, for example:

```ts
interface GridMilestoneDefinition {
  id: string;
  title: string;
  phase: string;
  dependsOn: string[];
  lanePatterns: string[];
  branchPatterns: string[];
  integrationCommitSignals: string[];
  notes?: string;
}
```

`integrationCommitSignals` are evidence matchers, not status flags. For example, the Road Network milestone may recognize the terminal Roads checkpoint commit while the live collector still confirms whether that commit is actually an ancestor of the selected integration ref.

The catalog must not store owners, heartbeat times, current branches, current status, or test results. Those are runtime facts.

## Runtime Collection

The collector should use programmatic sources, not scrape the formatted output of `npm run grid:agents -- status`.

It may reuse read-only helpers from `lib/agent-control.ts`, especially claim and Boardroom readers, but V1 must not modify those helpers or change the Control Tower CLI contract.

Git inspection should be read-only and bounded. Prefer `git for-each-ref`, `git worktree list --porcelain`, `git status --short`, `git log`, and `git merge-base --is-ancestor`. Do not run network fetches automatically.

The collector determines a default integration ref by preferring a configured `grid-integration-*` branch when available. The CLI must also support an explicit `--integration-ref <ref>` override so the operator can resolve ambiguity.
## Output Contract

The primary command is intended to be:

```bash
npm run grid:board
```

Default terminal output should be compact enough to scan quickly while still showing evidence. Group milestones by state, then show owner/branch/last evidence where relevant.

Example shape:

```text
THE GRID — MASTER BOARD
Integration ref: grid-integration-20260917 @ 48ed52b

IN PROGRESS
  MAP / 2.5D WORLD     owner=ChatGPT-Sol  lane=map-scene
  ALLIANCES            owner=...          branch=...

READY TO INTEGRATE
  <feature>             branch=<branch>    clean=yes

INTEGRATED
  ROAD NETWORK          evidence=GRID Roads 13
  MARKET CORE           evidence=GRID Market 4

PLANNED
  GRID PASSPORT
  LOCATION BONUSES
```

Support machine-readable `--json` output from the same data model. A later version may add richer HTML or web UI, but V1 does not need one.

## Shared Snapshot Without Merge Conflicts

V1 should not maintain a committed generated checklist file. A frequently changing Markdown file would create exactly the multi-agent merge conflicts this system is meant to prevent.
Instead, the command may optionally write a shared runtime snapshot under the Git common directory:

```text
.git/grid-agent-control/master-board.json
.git/grid-agent-control/master-board.md
```

These files are uncommitted and automatically shared across all linked worktrees, just like live claims. They are cache/snapshot artifacts only; the board can always be regenerated from source data.

The default command may print only. A flag such as `--snapshot` can refresh the shared files when a durable-at-this-moment view is useful to humans or agents.

## Proposed V1 File Boundaries

Implementation should stay isolated in new files where practical:

- `lib/grid/master-board/types.ts` — board data contracts and status enums.
- `lib/grid/master-board/milestones.ts` — stable milestone catalog.
- `lib/grid/master-board/classify.ts` — pure classification logic.
- `lib/grid/master-board/collect.ts` — read-only claims/Boardroom/Git collector.
- `lib/grid/master-board/render.ts` — terminal, JSON, and Markdown rendering.
- `scripts/grid-master-board.ts` — CLI argument parsing and orchestration.
- `tests/grid-master-board.test.ts` — pure classification and safety tests.
- `tests/grid-master-board-cli.test.ts` — CLI/output contract tests with fixtures.
- `package.json` — one additive `grid:board` script entry.

No existing gameplay, Grid engine, map, market, admin, chat, mobile, progression, or Supabase file should need modification for V1.

## Safety Invariants

The board is strictly observational. Tests must prove the implementation does not write to claims, Boardroom task files, Git refs, worktrees, or application data during ordinary collection/rendering.
Additional V1 invariants:

- no `git add`, `git commit`, `git merge`, `git checkout`, `git reset`, `git branch -D`, or ref mutation from the board command;
- no Control Tower `claim`, `heartbeat`, or `release` calls;
- no Boardroom task mutation;
- no Supabase/database access;
- no network requests and no automatic `git fetch`;
- no production deployment inference without explicit evidence;
- no modification of active agents' worktrees;
- stale or contradictory evidence must lower confidence rather than upgrade status.

If the repository is already in a coordination-warning state, `grid:board` should still be able to report that condition read-only. It must not “repair” claims automatically. Claim repair remains a coordinator/human action.

## Classification Rules

Classification should be deterministic and testable as a pure function over collected evidence.

1. If milestone integration evidence is an ancestor of the selected integration ref, classify `INTEGRATED` even if an old side branch still exists.
2. Else if a non-stale live claim maps to the milestone, classify `IN_PROGRESS`.
3. Else if a mapped clean side branch contains completion evidence and is not merged into the integration ref, classify `READY_TO_INTEGRATE`.
4. Else if mapped blocking evidence exists, classify `BLOCKED`.
5. Else if only the milestone catalog entry exists, classify `PLANNED`.
6. If evidence conflicts in a way the rules cannot safely resolve, classify `UNKNOWN` and include the conflict description.

A dirty released worktree is never `READY_TO_INTEGRATE`. A stale claim is not sufficient for `IN_PROGRESS`; it should be shown as a warning attached to the milestone or board health section.
## Board Health Section

The board should include a small health summary above milestone state:

- Boardroom autonomous mode active/inactive;
- count of live claims;
- stale claim count;
- coordination warning count and codes;
- selected integration ref and commit;
- local `main` / `origin/main` availability;
- timestamp generated.

This makes the board useful as an agent startup read without replacing the stricter `grid:agents -- check` gate.

## Performance

`grid:agents -- status` currently performs intentionally broad worktree/process inspection. The Master Board should avoid multiplying that cost unnecessarily.

V1 collection should:

- read claim JSON directly through existing helpers;
- read Boardroom summary through the existing read-only helper;
- enumerate Git refs once where possible;
- inspect only relevant candidate worktrees/branches for milestone evidence;
- cache commit subject/ancestry queries inside one invocation;
- avoid walking all source files.

The command should remain useful even as the repository accumulates many historical worktrees.

## Errors and Confidence

Operational errors must be surfaced instead of swallowed. A missing optional ref may produce `UNKNOWN` promotion status without failing the whole board. A missing Git repository or unreadable core coordination directory should fail the command with a clear non-zero exit.

The rendered board should distinguish **evidence** from **interpretation**. Example: “INTEGRATED — commit `dfa5042` ancestor of `grid-integration-20260917`” is preferable to an unexplained green check.
## Test Strategy

V1 should be testable without relying on the user's live worktrees or active agents.

Use fixture evidence to cover:

- an active claim producing `IN_PROGRESS`;
- a stale claim not producing `IN_PROGRESS`;
- a clean completed side branch producing `READY_TO_INTEGRATE`;
- a dirty side branch refusing `READY_TO_INTEGRATE`;
- completion evidence already ancestral to integration producing `INTEGRATED`;
- blocked Boardroom evidence producing `BLOCKED` when stronger evidence is absent;
- catalog-only milestones producing `PLANNED`;
- contradictory evidence producing `UNKNOWN` with an explanation;
- JSON and terminal renderers representing the same underlying state;
- snapshot mode writing only beneath the Git common coordination directory.

A live smoke test may run `grid:board` against the real repository after unit tests pass, but assertions must not depend on exact current agent counts because those are intentionally dynamic.

## V1 Acceptance Criteria

V1 is complete when:

1. One command shows the Grid-wide build state from current evidence.
2. Active agent lanes appear without agents manually editing a checklist.
3. Clean completed-but-unintegrated work is visibly separated from integrated work.
4. Major planned Grid systems remain visible even when no branch exists yet.
5. Boardroom blockers and Control Tower warnings are visible but not mutated.
6. The command makes no network, database, deployment, or game-state changes.
7. Existing `grid:agents` behavior remains unchanged.
8. Focused tests prove deterministic classification and read-only safety.
9. A generated snapshot, if requested, lives under the shared Git common directory rather than as a conflict-prone committed status file.
## Deferred to V2

The first release intentionally does not change agent startup rules. After V1 proves trustworthy, a separately approved V2 may:

- add `npm run grid:board` to the mandatory startup reading sequence in `AGENTS.md`;
- let agents request a machine-readable “best unclaimed next lane” recommendation;
- attach verification summaries from launch-readiness tooling;
- expose a local-only browser dashboard;
- record integration promotion events more explicitly;
- add optional CI or preflight checks for forgotten integration-ready branches.

Those changes affect shared workflow and therefore should not be bundled into V1 while many agents are active.

## Rollout

Implementation should happen in a new isolated worktree with a dedicated claim covering only the new Master Board files and the single `package.json` script addition. Before that implementation starts, run the normal Control Tower preflight again because current agent activity may have changed since this design was written.

The first implementation checkpoint should be merged only after focused Master Board tests pass and a real read-only run correctly reflects the live repository without changing any claim, branch, task, worktree, or application file.

## Final Design Decision

Build the Master Board as a **derived operational view**, not a second task database.

Agents continue to update the systems they already use naturally: claims while working, Git when committing, and Boardroom when supervised. The Master Board reads those facts and turns them into one understandable project-wide checklist. This preserves a single source of truth for each kind of evidence while giving Dustin and every agent one place to understand the whole Grid build.