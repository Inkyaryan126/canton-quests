# Grid NPC Runtime Evidence Storage

## Goal

Give stronghold readiness a real authoritative read source without converting absent strategic state into zero.

## Tables

- `grid_npc_season_runtime_state`: optional Surge intensity for a season. The row may be absent and `surge_intensity_bps` itself is nullable; either means unknown.
- `grid_npc_faction_pressure_state`: one authoritative pressure value per season/faction. Missing row means unknown.
- `grid_npc_stronghold_event_state`: explicit true/false event activation per registered season stronghold. Missing row means unknown.

No evidence rows are seeded by the migration. Browser roles cannot mutate them.

## Season activity

Season active/inactive is not duplicated into NPC state. The adapter derives it directly from `grid_seasons.status`, `starts_at`, `ends_at`, and the caller's validated `now` timestamp using the same active/surge and time-window semantics as game write commands.

## Read semantics

The adapter only returns rows that actually exist. It deliberately does not fill missing event/faction rows, and missing/nullable Surge intensity returns `null`. The NPC 9 readiness service decides whether a missing fact matters for the enabled definition(s).

This checkpoint supplies authoritative reads only. The engine/admin write commands for these evidence tables remain a separate audited slice.
