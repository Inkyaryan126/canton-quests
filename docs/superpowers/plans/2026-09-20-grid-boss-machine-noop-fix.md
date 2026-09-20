# Boss Machine no-op fix

## Problem
Builder OS treated a clean lead-process exit as a successful build cycle even when no canonical commit, claimed branch, or Control Tower claim changed. Repeated cycles could therefore show FINISHED while integrating nothing.

## Fix
- Preserve each completed run log before latest.log is reused.
- Snapshot canonical and claimed branch state before and after each cycle.
- Require observable repo or claim progress before marking a cycle finished.
- Mark successful-process/no-progress cycles needs_attention.
- Expand the supervisor fallback chain beyond Product Director to Master Board, live Boardroom/Control Tower, and explicitly documented unfinished work in canonical Grid specs, CURRENT_MISSION, and ROADMAP.
- If worker CLIs fail, allow the lead to execute one safe documented bounded task rather than ending empty.

## Safety
No production deploys, production DB changes, or invented gameplay mechanics. Any fallback work must already be defined in repository source-of-truth documents.
