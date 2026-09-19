# Grid Release Candidate Manifest Implementation Plan

## Goal

Create a read-only Grid release-candidate manifest that gives a nontechnical operator one authoritative snapshot of canonical release readiness by composing existing evidence, without deploying or mutating production.

## Scope

- `lib/grid/ops/release-candidate.ts`: Core data types, pure evaluators, evidence collector, and text renderer.
- `scripts/grid-release-candidate.ts`: Operator CLI with human-readable text and `--json` outputs.
- `tests/grid-release-candidate.test.ts`: Comprehensive test suite with synthetic and temp Git evidence.
- `docs/superpowers/specs/2026-09-19-grid-release-candidate-design.md`: Design document.
- `docs/superpowers/plans/2026-09-19-grid-release-candidate.md`: Implementation plan.

## Phases

### Phase 1: Data Contract & Types
- Define `ReleaseCandidateStatus` (`NOT_READY`, `READY_FOR_VERIFICATION`, `READY_FOR_HUMAN_RELEASE_DECISION`).
- Define `VerificationEvidenceStatus` (`VERIFIED`, `FAILED`, `MISSING`, `PENDING`).
- Define `ReleaseCandidateManifest` schema containing:
  - Git integration ref, commit, clean/dirty state, worktree path.
  - Control Tower coordination state, active claims, warnings, Boardroom status.
  - Master Board milestone counts and unintegrated breakdown.
  - Playable Loop score, status, broken link, stage verifications.
  - Product Director recommendations and count.
  - Production Activation preflight status and blockers summary.
  - Release gate planned steps.
  - Verification evidence list with extensible provider interface.
  - Recent canonical commits.
  - Deterministic operator next action.

### Phase 2: Evidence Collection & Status Evaluation
- Implement pure status evaluator `evaluateReleaseCandidateStatus`.
- Implement release gate step planner `getReleaseGatePlan`.
- Implement default verification evidence collector with honest missing evidence representation for browser runtime and migration safety.
- Implement evidence provider hook for future canonical extensions.
- Implement `collectGridReleaseCandidate` with options to inject or override dependencies for unit testing.
- Implement `renderReleaseCandidateText` for clear operator reading.

### Phase 3: CLI Script
- Create `scripts/grid-release-candidate.ts`.
- Support `--json`, `--integration-ref`, `--worktree`, `--check`, `--skip-build`, and `--help`.
- Ensure strictly read-only execution with zero mutation.

### Phase 4: Test Suite
- Test state transitions (`NOT_READY`, `READY_FOR_VERIFICATION`, `READY_FOR_HUMAN_RELEASE_DECISION`).
- Test honest reporting of missing runtime verification and migration safety evidence.
- Test conservative operator next action derivation.
- Test secret redaction and safety invariants.
- Test temp Git repo resolution and clean/dirty detection.
- Test text and JSON rendering.

### Phase 5: Verification & Delivery
- Run focused Vitest tests: `./node_modules/.bin/vitest run tests/grid-release-candidate.test.ts`.
- Run `git diff --check`.
- Commit changes and push branch `grid-release-candidate-20260919` to origin.
