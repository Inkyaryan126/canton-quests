# Boss three-slot crew scheduler v2

## Intent
The Boss Panel must run Codex, Claude, and Gemini as three independent worker slots on different tasks, not as fallbacks for one task.

## Scheduling contract
- The parent runner pre-binds the first Product Director wave by distinct task ID: recommendation 1 -> Codex, 2 -> Claude, 3 -> Gemini, and logs the mapping.
- Build subsequent safe queue/refills from Product Director, then Master Board prioritizer, then explicit unfinished repo specs.
- Pick up to three distinct tasks with provably non-overlapping file scopes.
- Create claims/worktrees before starting concurrent workers.
- Codex lead works the Codex slot directly; never launch nested Codex.
- Claude and Gemini each run non-interactively in their own claimed worktrees on different tasks.
- Start Claude and Gemini, then immediately work the Codex slot rather than waiting.
- When any slot finishes, verify/commit/DoD/release/integrate it and immediately refill that same CLI slot from a fresh queue scan.
- Repeat waves until the safe queue is exhausted, a real operator blocker appears, or the cycle time limit is reached.

## Failure behavior
- Never duplicate one task just to keep all three workers busy.
- If Claude/Gemini are unavailable or unauthenticated, mark only that slot unavailable; other slots continue.
- Do not collapse a failed Claude/Gemini assignment onto Codex merely to simulate three-worker activity.
- Verification-only evidence refresh remains parent/local-only when no source edit is needed.

## Safety
All implementation workers use isolated worktrees, exact Control Tower claims, non-overlapping scopes, focused verification, and existing Definition-of-Done/Merge Conveyor gates. No production deploys or production database changes.
