# Phase 3 — Mission entry / cold open

Phase 3 · Boardroom implementation note · 2026-09-07

## What changed

`app/events/[slug]/page.tsx` gains a single new gate, `MissionColdOpen`
(`components/game-effects/MissionColdOpen.tsx`), inserted where the old bare
`isLoading` spinner used to be. Every branch that already existed below it —
loading, load-error/retry, pre-launch, not-found, the two auth/participation
gates, the path-selector gate, and the live dashboard for both the Founder's
Cipher and every other Operation — is unchanged. The gate is a strict prefix:
it decides nothing about event status, auth, or path; it only decides *when*
to first reveal whichever of those branches was already going to render.

## Why this shape

The task asked for a cold open that works identically across every real
event status without new mechanics. Wrapping each status branch individually
would have meant touching 7+ return statements and risking a state-specific
regression. Gating once, before any status is known, means the boot sequence
composes with every current and future branch for free.

## Sequence

`MissionColdOpen` renders three stages built from the existing Phase 2
primitives (`HudSystemState`/`SystemStatusBadge`, `TransmissionLoader`,
`CqTransition`, `useReducedMotion`, `cqSoundManager`) — no new CSS, no new
sound assets:

1. **scanning** — `FIELD UPLINK` badge + `TransmissionLoader`, `scan` sound.
   Holds for a floor of 900ms (full motion) so a fast local fetch never
   skips the beat, then continues holding for as long as the real
   `/api/game/events/[slug]` fetch is still in flight.
2. **confirmed** or **denied** — once the fetch has actually settled: a
   genuine failure resolves to `denied` (`UPLINK FAILED`, `ui_error` sound)
   rather than falsely playing a signal-lock tone before falling through to
   the existing honest error/retry screen. A success resolves to
   `confirmed` (`SIGNAL LOCKED`, `lock_on` sound), showing the Mission title
   once known.
3. Reveal — `onDone()` fires, the page's `coldOpenComplete` state flips, and
   every existing branch renders exactly as before.

## Once-per-tab, not once-per-fetch

Gated by `sessionStorage['cq_cold_open_seen_<eventSlug>']`, scoped per
Operation. A returning visit in the same tab (switching dashboard tabs, the
existing 6s background refresh, a manual retry after a load error) never
replays the sequence — `MissionColdOpen` calls `onDone()` immediately with
nothing rendered. A new tab, or a different Operation, gets its own cold
open.

## Reduced motion

`TransmissionLoader`'s animated glyph bar and the scanning→confirmed stage
timing both still run, but shortened (220ms scan floor / 160ms confirm hold
vs. 900ms / 380ms) and without the animated bar — a single static status
line stands in for it. This is deliberately still a boot sequence, not a
skip: reduced-motion players still see the real state (`SIGNAL LOCKED` /
`UPLINK FAILED`) before the page reveals, just without motion or the
extended holds. `CqTransition`'s own reduced-motion contract (instant
opacity, no transform) handles the entrance.

## Deliberately out of scope here

- No changes to `app/globals.css`, `CommanderTransmission.tsx`, or
  `QuestRewardBreakdown.tsx` — none were needed for this gate.
- The existing `cipher_cold_open` Commander transmission (the "Cold Open"
  video that auto-plays once auth + participation resolve) is untouched and
  still fires on its own schedule, later than this boot sequence. They are
  sequential, not competing: hardware powering on, then a briefing once
  identity is confirmed.
- No change to quest list, event rules, leaderboard, or any gameplay data.
