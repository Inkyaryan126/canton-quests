# The Grid Release Candidate Manifest — Design

## Purpose

The Release Candidate Manifest is an authoritative, read-only operational snapshot that gives a nontechnical operator clear visibility into canonical release readiness. It synthesizes evidence from across The Grid's development and verification systems—Master Board, Control Tower, Playable Loop Score, Product Director, Production Activation Preflight, Release Gate, and Git history—into one deterministic report.

It answers one central question for the operator:
**"Is this candidate ready for human release decision, ready for verification, or not ready—and what is the exact conservative next action?"**

## Non-Negotiable Boundaries

1. **Strict Read-Only**:
   The manifest never deploys, triggers external builds, updates environment variables, mutates database records, or executes unconfirmed Git actions. It evaluates and reports evidence without side effects.
2. **Never Claim Production-Ready**:
   Code integration is not release readiness. Even if 100% of milestones are integrated and preflights pass, the candidate is only `READY_FOR_HUMAN_RELEASE_DECISION`. Final release promotion is always a human decision.
3. **Compose Existing Evidence**:
   No new artificial readiness scores or arbitrary percentage formulas are invented. The manifest composes existing empirical evidence: Master Board milestone statuses, Playable Loop score, Control Tower claims/warnings, Production Activation preflight report, and verification gate evidence.
4. **Represent Missing Evidence Honestly**:
   If runtime/browser verification or database migration safety evidence does not yet exist in canonical, it must be reported explicitly as `MISSING` rather than fabricating success.
5. **No Secret or Raw Private Identifier Exposure**:
   Environment secrets (e.g. `GRID_LOCATION_ATTESTATION_SECRET`), API keys, JWTs, and private player identifiers are never printed or serialized.

## Architecture & Composition

The manifest composes evidence from seven primary sources:

```
+-------------------------------------------------------------------------+
|                  THE GRID RELEASE CANDIDATE MANIFEST                    |
+-------------------------------------------------------------------------+
       |                  |                    |                    |
       v                  v                    v                    v
[ Master Board ]  [ Playable Loop ]    [ Control Tower ]   [ Product Director ]
- 27 milestones    - Score: 100/100    - Live claims       - Next safe work
- Integrated count - Status: GREEN     - Warnings          - Bottlenecks
- Status breakdown - Broken links      - Boardroom status  - Specialization
       |                  |                    |                    |
       v                  v                    v                    v
[ Activation Preflight ]  [ Release Gate Plan ]  [ Verification Evidence ]  [ Canonical Git ]
- Required ON flags       - Clean worktree req   - Browser runtime journey  - Integration ref
- Required OFF flags      - Preflight checks     - Migration safety gate    - Commit sha
- Secret length checks    - Test & lint commands - Full release gate status - Recent commits
```

### 1. Canonical Git & Worktree State
- Integration ref (e.g., `grid-canonical-integration-20260918`) and commit SHA.
- Clean vs dirty worktree state. Any uncommitted file immediately marks the candidate `NOT_READY`.
- Recent canonical commits on the integration ref to show recent progress and provenance.

### 2. Control Tower Coordination
- Active claims: any live claimed lane indicates active concurrent development, blocking release.
- Stale claims: flagged for operator attention.
- Coordination warnings: must be zero.
- Boardroom status: reports whether an autonomous supervisor session is active.

### 3. Master Board Milestones
- Total milestone count and integrated count.
- Percentage integrated (derived from `INTEGRATED / total`).
- Breakdown by milestone status (`INTEGRATED`, `READY_TO_INTEGRATE`, `IN_PROGRESS`, `DIRTY_DORMANT`, `BLOCKED`, `REJECTED`, `SAFE_NEXT_WORK`, `PLANNED`).
- Detailed list of any unintegrated milestones with current status and detail.

### 4. Playable Loop Readiness
- Overall score and status (`GREEN`, `YELLOW`, `RED`).
- Highest-value broken link (if any) with lost points and recommended repair.
- Stage breakdown and verification state (`browser/runtime verified` vs `browser/runtime not yet verified`).

### 5. Product Director
- Active recommendation count and summary.
- Recommended work items with action type (`IMPLEMENT`, `INTEGRATE`, `VERIFY`), specialization, and rationale.

### 6. Production Activation Preflight
- Pure evaluation via `evaluateGridProductionActivation`.
- Status (`READY_FOR_RELEASE_GATE` vs `BLOCKED`).
- Specific blocker list (e.g., missing player flags, unconfigured maintenance flags, weak location secret, dirty worktree, live claims).
- Strictly zero secret value leakage.

### 7. Planned Release Gate Steps
- Inspection of the steps that `npm run grid:release-gate` will execute.
- Clean worktree requirement and build requirement.

### 8. Extensible Verification Evidence
- Evidence items representing test and verification gates:
  - `browser-runtime`: Browser runtime journey verification. Defaults to `MISSING` if not present.
  - `migration-safety`: Database migration safety gate. Defaults to `MISSING` if not present.
  - `release-gate`: Full release gate status. Defaults to `PENDING` if not yet executed for candidate commit.
- Pluggable evidence provider interface (`ReleaseCandidateEvidenceProvider`) allowing future evidence sources to inject verified records without modifying the output schema.

## Deterministic Status Semantics

The manifest assigns one of three mutually exclusive statuses:

```
[ NOT_READY ]
     |
     | (All prerequisites met: clean worktree, 0 claims, 0 warnings,
     |  100% milestones integrated, playable loop 100 GREEN, activation preflight clean)
     v
[ READY_FOR_VERIFICATION ]
     |
     | (All verification gates passed: release-gate VERIFIED,
     |  browser-runtime VERIFIED, migration-safety VERIFIED)
     v
[ READY_FOR_HUMAN_RELEASE_DECISION ]
     |
     +--> (Human operator review & sign-off; NEVER auto-deployed)
```

### Detailed Status Conditions

1. `NOT_READY`:
   - Worktree has uncommitted modifications.
   - Integration ref or commit is unresolved.
   - One or more Control Tower claims are active or stale.
   - Control Tower coordination warnings exist.
   - Any Master Board milestone is not `INTEGRATED`.
   - Playable Loop score is less than 100 or status is `RED`/`YELLOW`.
   - Production Activation Preflight reports `BLOCKED` with one or more blockers.
   - Any verification evidence item has failed.
   - **Operator Next Action**: Concrete instruction identifying the specific blocker to resolve first.

2. `READY_FOR_VERIFICATION`:
   - All conditions for code integration and activation preflight pass cleanly.
   - However, one or more verification evidence gates (e.g. `release-gate`, `browser-runtime`, `migration-safety`) are `MISSING` or `PENDING`.
   - **Operator Next Action**: "Run 'npm run grid:release-gate' and complete browser runtime and migration safety verification."

3. `READY_FOR_HUMAN_RELEASE_DECISION`:
   - All prerequisites pass AND all verification evidence gates are `VERIFIED`.
   - **Operator Next Action**: "All automated release prerequisites, preflights, and verification gates have passed. Submit candidate commit <commit> to human release authority for sign-off (never auto-deploy)."

## CLI Interface

- Human-readable text format (default) organized into structured operator sections with visual status indicators.
- Machine-readable JSON (`--json`) formatted for automated pipelines and dashboards.
- Optional flags:
  - `--integration-ref <ref>`: Evaluate a specific integration branch or ref.
  - `--worktree <path>`: Evaluate an alternative worktree directory.
  - `--check`: Exit code 0 if `READY_FOR_HUMAN_RELEASE_DECISION`, exit code 1 if not ready.
  - `--skip-build`: Evaluate release gate plan with production build skipped.
