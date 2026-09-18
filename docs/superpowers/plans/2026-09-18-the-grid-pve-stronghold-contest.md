# Grid PvE Stronghold Contest Core

## Goal

Make NPC strongholds mechanically fightable without representing NPC factions as fake player accounts or reusing PvP persistence that requires a real `defender_player_id`.

## Core model

- A contest starts only from an `active`, `contestable` NPC stronghold projection.
- The stronghold's projected garrison is snapshotted as the defender's initial Influence.
- The attacker commits a positive amount of Influence.
- Every round delegates dice validation/comparison/loss math to the existing `resolveSignalDiceRound()` Core, so PvE follows the same Signal Dice mechanics as PvP.
- Remaining attacker Influence and NPC garrison persist in immutable contest state passed from round to round.
- The stronghold is captured only when garrison reaches zero while attacker Influence remains above zero.
- If attacker Influence reaches zero, the assault is repelled. If both sides reach zero in the same round, defender advantage wins and the assault is repelled.

## Deliberate boundary

This checkpoint contains no database writes, API route, rewards, or territory transfer. Persistence needs its own NPC-specific atomic boundary because the existing PvP `grid_contests` table requires a non-null real player defender. The next slice should persist a PvE contest/session separately and append immutable Grid events rather than weakening PvP schema guarantees.
