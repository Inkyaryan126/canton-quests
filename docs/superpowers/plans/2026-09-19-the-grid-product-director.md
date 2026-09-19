# The Grid Product Director implementation plan

Goal: turn existing Master Board, Prioritizer, Playable Loop Score, and live claim evidence into a read-only assignment slate for the three-agent development workflow.

Implementation:
- Compose existing prioritizer recommendations rather than create another dependency graph or scoring model.
- Prefer a recommendation that maps to the highest-value playable-loop break.
- Prefer integration-ready work over equivalent implementation work.
- Exclude claimed, overlapping, unsafe, non-actionable, or dependency-blocked candidates.
- Return no filler when fewer than the requested number of safe recommendations exist.
- Emit one of three owner specializations: backend/gameplay, player UI/UX, verification/ops.
- Keep scope hints conservative; when exact file scope is unknown, require the orchestrator to derive it before claiming.

Verification: focused Product Director tests and git diff check only.
