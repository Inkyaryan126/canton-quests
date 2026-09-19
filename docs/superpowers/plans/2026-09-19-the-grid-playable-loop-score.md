# The Grid Playable Loop Score Implementation Plan

- [x] Define nine weighted journey stages totaling 100 with early/action priority.
- [x] Add pure deterministic scoring with GREEN/YELLOW/RED contributions, missing-evidence handling, and deterministic broken-link selection.
- [x] Add read-only Master Board and repository-probe adapter plus text/JSON CLI and optional integration ref.
- [x] Add focused tests for all-green, early hard break, late degradation, weighting/ties, missing evidence, and runtime-verification labeling.
- [x] Document hourly orchestrator and release usage.

Verification is limited to the requested focused suite, TypeScript check, and `git diff --check`; full repository tests are intentionally out of scope.
