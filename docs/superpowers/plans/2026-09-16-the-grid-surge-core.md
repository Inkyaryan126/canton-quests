# The Grid — Surge Core

**Date:** 2026-09-16
**Lane:** `surge-core`
**Branch:** `grid-surge-core-20260916`
**Worktree:** `/private/tmp/grid-surge-core`

## Goal

Implement the city-agnostic, deterministic core for **The Surge**, the configured finale phase near the end of a Grid season.

The source design describes The Surge as the final approximately 72 hours of a season where strategic value rises, hotspots activate, special objectives appear, NPC strongholds can come online, map presentation changes, and final rankings receive extra emphasis.

## This lane owns

- Surge configuration validation.
- Explicit or derived Surge activation time.
- Deterministic phase projection: pre-season, regular, surge, ended.
- Surge countdown, remaining time, and progress.
- Finale value multipliers.
- Special-objective and NPC-stronghold slot signals.
- Final-ranking emphasis signal.
- Deterministic hotspot scoring and district-spread selection.
- A Dominance Heat exposure multiplier hook for later integration.

## This lane intentionally does not own

- Database persistence or season-status mutation.
- Contest mutation paths.
- Progression or leaderboard writes.
- Dynamic-event persistence or activation.
- NPC faction implementation.
- Dominance Heat implementation.
- City Power implementation.
- Player-facing Surge UI.
- Canton-specific tuning.
- `GridCityPackage` changes.

Those areas either belong to active parallel lanes or should integrate only after this pure core contract is accepted.

## Determinism rules

No function reads the wall clock directly. The caller supplies `now`.

Hotspot scoring uses only normalized basis-point inputs and configured integer weights. Ties resolve by district slug then territory slug.

District caps prevent every finale hotspot from clustering in one neighborhood. If the available candidate distribution cannot satisfy the desired hotspot count without breaking the district cap, the engine returns fewer hotspots rather than silently violating the rule.

## Safety / balance guardrails

- Hotspot weights must total exactly 10,000 basis points.
- Candidate metrics remain in the 0–10,000 range.
- Finale value/exposure multipliers cannot reduce below normal-season value.
- Multipliers are capped at 5× normal value.
- Malformed season windows fail closed.
- Explicit Surge start must fall inside the playable season window.

## Integration path

A later integration lane can wire this projection to the season runtime:

1. Resolve the imported city + active season.
2. Load city/season Surge tuning.
3. Build normalized hotspot candidates from existing world state.
4. Call `projectGridSurge`.
5. Apply returned multipliers/signals through server-authoritative economy, City Power, Dominance Heat, dynamic event, and presentation paths.
6. Keep the pure Surge engine free of Supabase, UI, and city-specific dependencies.

This preserves the multi-city architecture: Canton supplies tuning and candidate data; the same Surge engine runs anywhere.
