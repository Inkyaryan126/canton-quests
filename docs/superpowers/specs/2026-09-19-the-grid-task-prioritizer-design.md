# Grid Task Prioritizer Design

## Contract

The prioritizer consumes the existing `GRID_MILESTONES` catalog and its
`dependsOn` fields. It never maintains a second dependency graph. Before
scoring, it rejects duplicate milestone IDs, unknown dependencies, and cycles
with deterministic error text.

Only `SAFE_NEXT_WORK` and `READY_TO_INTEGRATE` are actionable by default.
Callers can pass an explicit status set when a different deterministic policy
is needed.

## Score

Each recommendation exposes the components that make up its total:

`playerImpact + dependencyUnlock + launchValue + urgency + phaseWeight - coordinationRiskPenalty`

- `playerImpact` favors player-facing and playable-loop phases and titles.
- `dependencyUnlock` is five points per transitive downstream milestone.
- `launchValue` favors launch, operations, season, and release-readiness work.
- `urgency` gives `READY_TO_INTEGRATE` a higher value than `SAFE_NEXT_WORK`.
- `coordinationRiskPenalty` accounts for warnings, ownership, and branch state.
- `phaseWeight` is an explicit, overridable phase contribution.

Scores are integers. Ties are resolved by ascending milestone ID, so the same
board and graph always produce the same order.

## Output

Each recommendation includes direct dependency IDs and their observed statuses,
transitive downstream unlock IDs, the source board detail, the score
breakdown, and a short `whyNow` explanation. The CLI is read-only: it only
collects board evidence and writes output to stdout.
