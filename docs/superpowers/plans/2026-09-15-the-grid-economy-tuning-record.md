# THE GRID — Founding Season Economy Tuning Record

**Date:** 2026-09-15
**Scope:** Economy Phase Task 7 — deterministic simulation + initial Canton tuning seed

## Simulation setup

- Seeds: `20260915`, `4242`, `1337`
- Players: 6
- Season length: 30 days
- Activity cadences: 1h, 2h, 4h, 8h, 12h, 24h
- Offline accrual cap: 12 hours
- Geography/economy source: Canton Founding Season package

## Structural result

All three runs completed with **zero invariant violations**. The simulator exercised joining, starter claims, adjacency expansion, property acquisition, development, offline-cap loss, and Skyline formation. Same-seed replay is covered by tests and is deterministic.

## Three-seed averages

- Credits remaining: 21,537
- Influence remaining: 22,507
- Claimed territories: 20
- Acquired properties: 11
- Development levels purchased: 21
- Territory Gini: 0.3000
- Property Gini: 0.5707

## Balance observations

Territory control is reasonably distributed in this synthetic six-player run. Property ownership is more concentrated than territory ownership and should be watched during later playtests, but it is not a structural failure and does not justify guessing new constants before real player data exists.

Median first-claim time is immediate because the six configured starter slots give every simulated player a fair opening claim. First-property, first-upgrade, and first-Skyline timing varies materially by seed and activity cadence, which is desirable for a strategy simulation rather than a scripted progression.

The 24-hour cadence player loses offline accrual time under the 12-hour cap, proving the cap is active and preventing unlimited passive banking.

## Tuning decision

Keep the current Founding Season values as the **initial tunable seed**. No balance constants were changed solely to optimize these three synthetic runs. Revisit property concentration, starter-claim pacing, and Skyline timing after the player-visible projection exists and real playtest behavior can be observed.

## Production gate

This record does **not** approve production economy activation. Production migrations/activation remain behind the separate human approval gate defined in the Economy Phase plan.

## Saturation and ROI follow-up

After completing the missing report metrics, the same three seeds show full territory saturation at hours 128, 44, and 104. All 11 current properties are acquired at hours 668, 594, and 547 respectively, so property acquisition stretches across most of the 30-day synthetic season while territory control is established much earlier.

The configured three-level Commerce branch costs 5,900 Credits plus 6 Command Points and adds 16 Credits/hour in cumulative branch yield, for a simple Credit payback of 368.75 hours (~15.4 days). Influence produces 13 Influence/hour at the same spend; Prestige produces 6 Influence/hour plus its prestige effects. Fortress and Intel intentionally have no direct Credit payback because their value belongs to later contest/defense/intel phases.

These numbers reinforce the decision to keep the initial tuning seed unchanged for now: territory expansion is fast enough to establish a board, property investment remains a longer-term race, and the defensive/intel branches should not be judged on financial ROI before their gameplay effects are activated.
