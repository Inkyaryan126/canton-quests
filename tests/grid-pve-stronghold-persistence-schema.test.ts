import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918065500_grid_pve_stronghold_contests.sql'),
  'utf8',
);

describe('Grid PvE stronghold persistence schema', () => {
  it('keeps NPC contests separate from the real-player PvP table', () => {
    expect(sql).toContain('create table public.grid_pve_stronghold_contests');
    expect(sql).toContain("status in ('active', 'captured', 'repelled')");
    expect(sql).toContain('attacker_player_id uuid not null references public.players');
    expect(sql).not.toMatch(/alter table public\.grid_contests[\s\S]*defender_player_id/i);
    expect(sql).not.toContain('defender_player_id uuid');
  });

  it('atomically escrows only attacker Influence and refunds surviving attacker Influence', () => {
    expect(sql).toContain("'prepve-start:a:' || p_idempotency_key");
    expect(sql).toContain('influence = influence - p_attacker_committed_influence');
    expect(sql).toContain('v_attacker_refund := v_attacker_remaining');
    expect(sql).toContain('influence = influence + v_attacker_refund');
    expect(sql).not.toContain('garrison_refund');
  });

  it('requires attacker ownership, adjacency, and a neutral target', () => {
    expect(sql).toContain('PVE_CONTEST_TERRITORIES_NOT_ADJACENT');
    expect(sql).toContain('SOURCE_TERRITORY_NOT_OWNED_BY_ATTACKER');
    expect(sql).toContain('v_target_state.owner_player_id is not null');
    expect(sql).toContain('PVE_TARGET_MUST_BE_NEUTRAL');
    expect(sql).toContain('and owner_player_id is null');
    expect(sql).toContain('PVE_CONTEST_TARGET_OWNERSHIP_CHANGED');
  });

  it('serializes PvP/PvE target reservations across both tables', () => {
    expect(sql).toContain('grid_guard_contest_target_exclusivity');
    expect(sql).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(sql).toContain("tg_table_name = 'grid_contests'");
    expect(sql).toContain("tg_table_name = 'grid_pve_stronghold_contests'");
    expect(sql).toContain('grid_contests_cross_mode_target_guard');
    expect(sql).toContain('grid_pve_stronghold_contests_cross_mode_target_guard');
  });

  it('revalidates server dice and resolves threshold exhaustion with defender advantage', () => {
    expect(sql).toContain('PVE_CONTEST_DICE_COUNT_INVALID');
    expect(sql).toContain('PVE_CONTEST_DIE_RESULT_INVALID');
    expect(sql.indexOf("v_status := 'repelled'")).toBeLessThan(sql.indexOf("v_status := 'captured'"));
    expect(sql).toContain('v_attacker_post_dice <= 0');
    expect(sql).toContain('v_garrison_post_dice <= 0');
  });

  it('writes immutable idempotent PvE start and round events', () => {
    expect(sql).toContain("'grid:pve_stronghold_contest_started'");
    expect(sql).toContain("'grid:pve_stronghold_round_resolved'");
    expect(sql).toContain("'pve_stronghold_contest'");
    expect(sql).toContain('IDEMPOTENCY_KEY_COLLISION');
    expect(sql).not.toMatch(/update\s+public\.grid_game_events/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.grid_game_events/i);
  });

  it('locks RPC execution to service_role', () => {
    expect(sql).toContain('revoke all on function public.grid_start_pve_stronghold_contest');
    expect(sql).toContain('revoke all on function public.grid_resolve_pve_stronghold_round');
    expect(sql.match(/to service_role;/g)?.length).toBe(2);
  });
});
