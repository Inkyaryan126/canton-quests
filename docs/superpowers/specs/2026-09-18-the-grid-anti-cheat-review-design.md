# The Grid Anti-Cheat Review Persistence Design

**Status:** APPROVED FOR LOCAL IMPLEMENTATION — 2026-09-18

## Boundary

Anti-cheat assessments are private server telemetry. Trusted server callers supply city, season, player, action, stable assessment key, core assessment, and signal evidence. This lane adds no player-facing route, projection, UI, sanction, or account mutation.

## Durable model

- `grid_anti_cheat_assessments` stores the immutable assessment snapshot and city/season/player/action scope.
- `grid_anti_cheat_signals` stores one immutable row per ordered signal ID with kind, severity, confidence, source, and reason code.
- `grid_anti_cheat_reviews` is an immutable audit stream for human review state (`pending`, `in-review`, `resolved`) and resolution metadata.

The assessment key is unique within city and season. A transactional service-role RPC inserts the assessment, all signal rows, and the initial review row together. Replays compare the complete stored scope, assessment, ordered IDs, and signal evidence; any mismatch raises a conflict.

## Privacy and safety

RLS is enabled and direct `anon`/`authenticated` table and function access is revoked. Only service-role execution is granted. Review resolution is audit metadata only. No function updates players, reputation, rewards, bans, suspensions, confiscations, or account state.

## Review queue

`monitor`, `review`, and `reject-command` assessments receive a pending review row. Queue reads return the latest non-resolved review state. Review transitions append a new row and never mutate the assessment or player state.

## Verification contract

Focused tests cover service validation, adapter RPC mapping, private schema grants, append-only triggers, transactional insertion, replay conflict handling, ordered signal evidence, review states, and absence of sanction/account mutations. Full-repository tests and production database changes are outside this lane.
