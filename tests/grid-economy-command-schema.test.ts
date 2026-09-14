import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migrationText(): string {
  const file = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260914160000_grid_season_economy_commands.sql',
  );
  if (!fs.existsSync(file)) throw new Error('Grid economy command migration not found');
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('GRID season economy command SQL contract', () => {
  it('defines explicit security-invoker atomic join and settlement RPCs', () => {
    const sql = migrationText();
    expect(sql).toContain('create or replace function public.grid_join_season');
    expect(sql).toContain('create or replace function public.grid_settle_player_resources');
    expect(sql.match(/security invoker/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).not.toContain('security definer');
  });

  it('revokes browser/public execution and grants only service_role execution', () => {
    const sql = migrationText();
    for (const fn of ['grid_join_season', 'grid_settle_player_resources']) {
      expect(sql).toContain(`revoke all on function public.${fn}`);
      expect(sql).toContain('from public, anon, authenticated');
      expect(sql).toContain(`grant execute on function public.${fn}`);
      expect(sql).toContain('to service_role');
    }
  });

  it('locks season/player state and checks active timing plus explicit economy configuration', () => {
    const sql = migrationText();
    expect(sql).toContain("status not in ('active', 'surge')");
    expect(sql).toContain("raise exception 'season_not_active'");
    expect(sql).toContain("raise exception 'economy_not_configured'");
    expect(sql.match(/for update/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('joins naturally once and appends the immutable join event in the same function', () => {
    const sql = migrationText();
    expect(sql).toContain('insert into public.grid_player_season_state');
    expect(sql).toContain('on conflict (season_id, player_id) do nothing');
    expect(sql).toContain("'grid:season_joined'");
    expect(sql).toContain('insert into public.grid_game_events');
    expect(sql).toContain('p_idempotency_key');
  });

  it('settles CP with cap semantics and Credits/Influence with integer remainder math', () => {
    const sql = migrationText();
    expect(sql).toContain('credits_accrual_remainder');
    expect(sql).toContain('influence_accrual_remainder');
    expect(sql).toContain('3600000');
    expect(sql).toContain('offlineaccrualcapminutes');
    expect(sql).toContain('commandpointregenminutes');
    expect(sql).toContain('resources_settled_at = p_now');
  });

  it('emits resources-settled only when resource state actually changes', () => {
    const sql = migrationText();
    expect(sql).toContain("'grid:resources_settled'");
    expect(sql).toContain('if v_credits_earned > 0 or v_influence_earned > 0 or v_cp_regenerated > 0 then');
  });
});
