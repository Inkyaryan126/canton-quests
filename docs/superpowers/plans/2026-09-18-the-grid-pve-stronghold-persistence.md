# Grid PvE Stronghold Persistence

## Goal

Persist NPC stronghold fights without weakening PvP player-vs-player invariants.

## Storage and transaction rules

- `grid_pve_stronghold_contests` is separate from `grid_contests`; NPC factions are never fake `players` rows.
- Starting a fight requires an active/surge season, same-city adjacent territories, a source owned by the attacker, and a neutral target.
- The full attacker commitment is escrowed from seasonal Influence. NPC garrison is virtual combat state and has no wallet.
- Start and round commands are idempotent through `grid_game_events`.
- Round dice count/results are revalidated inside SQL against the season contest config even though they were generated server-side.
- When a fight ends, surviving attacker Influence is refunded. Lost Influence remains spent.
- Capture transfers only a still-neutral target. A changed target aborts atomically rather than overwriting ownership.
- Positive remaining Influence below the minimum Signal Dice threshold counts as inability to continue. Attacker inability is evaluated first, preserving defender advantage.

## Cross-mode concurrency

PvP and PvE use different tables. A shared target-guard trigger uses one transaction advisory lock derived from `(season_id,target_territory_id)` on inserts/active updates in both tables. This prevents a simultaneous PvP and PvE start from creating two active contests for one target.

## Configuration trust

The database can prove territory/economy/session facts but does not yet have a canonical NPC stronghold registry. `createSupabaseGridPveStrongholdSessionPort` therefore requires an injected trusted `resolveStronghold()` function. Only service-role RPCs can persist the resulting faction/garrison snapshot. Production route wiring must not accept these values from clients.
