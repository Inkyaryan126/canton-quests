# The Grid Board Archive Evidence Repair

**Date:** 2026-09-19

## Problem
The canonical integration branch already contains the complete Season Conclusion & Archive patch through `GRID player loop: integrate archive power and offline defense`, but the Master Board only recognized the later side-branch subject `GRID Season: archive final standings and Passport history`. That made an already-integrated milestone appear `READY_TO_INTEGRATE`.

## Repair
Recognize both exact engineering checkpoint subjects for the same completed archive milestone. Keep the match specific; do not add generic `archive` or `season` substrings.

## Verification
A collector regression test creates an integration commit with the canonical subject and requires `season-archive` to classify as `INTEGRATED`. The catalog test pins both accepted subjects.
