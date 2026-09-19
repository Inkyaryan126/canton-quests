# Grid Product Director Type Contract Repair

## Problem

Product Director intentionally accepts two inputs: the real `GridMasterBoard` and lightweight synthetic boards carrying explicit candidates for deterministic tests/automation. Its input interface extended `Partial<GridMasterBoard>` while redefining `milestones` with a lighter element shape. TypeScript correctly rejected that override because a present `Partial<GridMasterBoard>.milestones` must still be `GridMilestoneState[]`.

The runtime narrowing was also too permissive: a lightweight milestone with only `phase` and `detail` could be treated as a full Master Board even though the prioritizer requires fields such as `promotion` and `warnings`.

## Repair

- Model `GridProductDirectorBoard` as `Omit<Partial<GridMasterBoard>, 'milestones'>` plus its explicit lightweight milestone array.
- Preserve optional `promotion` and `warnings` on the lightweight milestone shape so a real `GridMasterBoard` remains structurally assignable.
- Narrow to `GridMasterBoard` only when version, health, milestone status, promotion, detail, and warning fields satisfy the full runtime contract.
- Keep explicit-candidate lightweight boards working without fabricated Master Board evidence.

This is a type/runtime-contract repair only; prioritization scoring and product decisions do not change.
