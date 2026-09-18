# The Grid Contract Core Design

## Purpose

Grid Contracts are the reusable objective primitive for seasonal goals, underdog opportunities, anti-monopoly pressure, NPC PvE objectives, city events, and tutorials.

They are not Canton Quests legacy quests. The core is city-agnostic, deterministic, and contains no database, UI, map, or Supabase behavior.

## Invariants

- Every contract has at least one uniquely identified counter objective.
- Objective targets and resource rewards are non-negative safe integers; targets start at 1.
- Progress is monotonic and capped at the configured target.
- A contract completes only when every objective reaches its target.
- Completion emits reward **intent**; the core never mutates wallets/resources.
- Completion rewards are emitted only on the active -> completed transition.
- Expired or completed contracts ignore later progress.
- Contract transitions return new state and do not mutate the caller's instance.

## Remote-first rule

Physical presence is never a completion requirement in this core.

A definition may include an optional `locationEnhancement` bonus. A player can complete the base contract remotely; location-enhanced participation only makes an additional bonus reward eligible.
## Contract kinds

- `seasonal` — broad season objectives
- `underdog` — opportunity for smaller/newer players
- `anti-monopoly` — pressure around dominant players/alliances
- `npc` — PvE faction/stronghold objectives
- `event` — dynamic city-event objectives
- `tutorial` — onboarding-safe objectives

These kinds classify intent only. Selection, targeting, and balance algorithms live above the core.

## Reward boundary

`rewardIntent` and `locationBonusIntent` are pure outputs. A later server-authoritative service must grant them transactionally, idempotently, and through the Grid event ledger. Client code must never award these resources directly.

## Deliberately out of scope

- persistence/schema/API routes
- contract discovery, ranking, or assignment
- Dominance Heat selection algorithms
- mapping arbitrary game events to objective counters
- alliance-shared contracts
- narrative/localized copy
- player UI
- automatic wallet/resource mutation

These belong in later isolated milestones after this state machine is accepted.