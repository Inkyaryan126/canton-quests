# Boss steady-state success

## Problem
A correctly idle Boss cycle was being marked `needs_attention` whenever it made no repo/evidence changes, even when all Grid milestones were integrated, the Playable Loop was GREEN, no work was actionable, and full current-commit release evidence already passed.

## Fix
- Add a pure steady-state predicate for complete/action-free Builder snapshots.
- Keep the existing no-op guard for any actionable recommendation, worker, ready merge, incomplete milestone set, or non-GREEN playable loop.
- Require full release-gate PASS evidence with the production build included for the exact current canonical commit before a no-change cycle can finish successfully.
- Report the finished state as already up to date rather than as an error.

## Safety
This does not create work, deploy, or alter production configuration. It narrows steady-state success to a stricter fully verified terminal condition and leaves false-success blocking intact everywhere else.
