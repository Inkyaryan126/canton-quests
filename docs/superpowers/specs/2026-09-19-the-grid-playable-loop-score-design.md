# The Grid Playable Loop Score

## Purpose

The Playable Loop Score is a read-only, deterministic operational check for whether a new player can enter The Grid, become situated, take a meaningful action, observe a consequence and progression, and understand why to return.

It consumes the existing Master Board plus explicit repository probes. It does not claim browser/runtime success unless runtime evidence is explicitly supplied. It does not mutate claims, branches, databases, or player state.

## Canonical stages and weights

The fixed journey is: entry (16), identity/Home City (14), season join (12), starter territory (12), map/world comprehension (10), meaningful action (16), consequence/reward persistence (10), progression/rank visibility (5), and return experience/next-action clarity (5). The weights total 100 and bias failures in entry, onboarding, and action above late polish.

GREEN contributes 100% of its stage weight, YELLOW 50%, and RED 0%. Missing evidence is YELLOW with an explicit `missing evidence` verification label. Highest-value broken link is selected by lost points, then canonical stage order for deterministic ties.

## Evidence contract

Master Board `INTEGRATED` is implementation/integration evidence and produces GREEN. `IN_PROGRESS`, `READY_TO_INTEGRATE`, and `SAFE_NEXT_WORK` produce YELLOW. `BLOCKED`, `REJECTED`, `PLANNED`, and `UNKNOWN` produce RED. Route/UI/API file probes only establish repository presence and produce YELLOW until browser/runtime evidence exists. The report labels every stage as browser/runtime verified, not yet verified, or missing evidence.

## CLI

Run the script through the repository's existing Vite Node runner:

```sh
node ./node_modules/vite-node/vite-node.mjs scripts/grid-playable-loop-score.ts
node ./node_modules/vite-node/vite-node.mjs scripts/grid-playable-loop-score.ts --json
node ./node_modules/vite-node/vite-node.mjs scripts/grid-playable-loop-score.ts --integration-ref grid-integration-YYYYMMDD
```

Default output is human-readable text. `--json` emits only the score object. The optional integration ref is passed to the read-only Master Board collector and fails closed if the ref does not exist.

## Orchestrator use

The hourly orchestrator should run this score after refreshing the Master Board and before assigning new work. Assign the recommended repair for the highest-value broken link first, while preserving existing lane claims and scopes. Run it again before release; a release recommendation requires no RED stages and explicit review of any YELLOW stages, especially those still marked browser/runtime not yet verified.
