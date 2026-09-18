# Grid PvE Stronghold Retreat / Withdraw

## Goal

Never strand a player's committed Influence inside an unwanted NPC stronghold fight.

## Semantics

- Only the contest attacker may withdraw an active PvE contest.
- Withdrawal is allowed even if the season has since ended; escrow release must not depend on continued season activity.
- All surviving attacker Influence is refunded atomically to `grid_player_season_state`.
- Lost attacker Influence remains spent.
- NPC garrison state has no player wallet and receives no refund.
- The neutral target territory is not modified.
- Contest status becomes `withdrawn` and `ended_at` is recorded.
- Exact retries are idempotent through `grid_game_events`; key collisions reject.
- The RPC is service-role only.

## Player API

`POST /api/grid/stronghold-contests/[contestId]/withdraw` accepts only an idempotency key from the authenticated attacker. The response returns the opaque contest id, stronghold id, withdrawn status, refunded Influence, and end timestamp—never city/season/player/event UUIDs.
