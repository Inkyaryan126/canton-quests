import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260916013000_grid_contest_sessions.sql',
  ),
  'utf8',
);

describe('Grid persistent contest session schema', () => {
  it('stores one active contest per target territory', () => {
    expect(sql).toContain('create table public.grid_contests');
    expect(sql).toContain('grid_contests_active_target_uq');
    expect(sql).toContain("where status = 'active'");
  });

  it('escrows attacker and defender Influence on contest start', () => {
    expect(sql).toContain('influence = influence - p_attacker_committed_influence');
    expect(sql).toContain('influence = influence - p_defender_committed_influence');
    expect(sql).toContain('attacker_remaining_influence');
    expect(sql).toContain('defender_remaining_influence');
  });

  it('requires adjacency and current ownership before locking reserves', () => {
    expect(sql).toContain('CONTEST_TERRITORIES_NOT_ADJACENT');
    expect(sql).toContain('SOURCE_TERRITORY_NOT_OWNED_BY_ATTACKER');
    expect(sql).toContain('TARGET_TERRITORY_NOT_OWNED_BY_DEFENDER');
  });

  it('refunds both surviving reserves when the attacker withdraws', () => {
    expect(sql).toContain('grid_withdraw_contest');
    expect(sql).toContain('influence = influence + v_contest.attacker_remaining_influence');
    expect(sql).toContain('influence = influence + v_contest.defender_remaining_influence');
    expect(sql).toContain("'grid:contest_withdrawn'");
  });

  it('keeps all contest mutations service-role only', () => {
    expect(sql).toContain('revoke insert, update, delete on public.grid_contests from anon, authenticated');
    expect(sql).toContain('grant execute on function public.grid_start_contest');
    expect(sql).toContain('grant execute on function public.grid_withdraw_contest');
    expect(sql.match(/to service_role;/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
