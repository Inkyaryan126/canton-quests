# The Grid Product Director design

The Product Director is a derived, read-only operational view. It is not a task database and does not mutate Control Tower or Boardroom state.

Inputs:
- Grid Master Board state
- existing deterministic Prioritizer output
- Playable Loop Score and highest-value broken link
- live Control Tower claims

Output:
- concise director summary
- up to N safe recommendations, default 3
- action type, why-now rationale, dependency context, evidence, specialization, acceptance criteria, and conservative scope hints

Safety rules:
- never recommend already-claimed or scope-overlapping work
- never recommend dependency-blocked or non-actionable work
- never invent filler or exact file scope without evidence
- use existing prioritizer scores rather than a competing score
- map work only to backend/gameplay, player UI/UX, or verification/ops

The hourly orchestrator should read Product Director output before assigning a free agent, then create the actual exact claim only after validating the recommended scope against current live claims.
