import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260916041000_grid_offline_defense_policies.sql',
    ),
    'utf8',
  )
  .toLowerCase();

describe('Grid offline defense persistence schema', () => {
  it('stores one policy per joined player and season', () => {
    expect(sql).toContain('create table public.grid_offline_defense_policies');
    expect(sql).toContain('primary key (season_id, player_id)');
    expect(sql).toContain(
      'references public.grid_player_season_state(season_id, player_id)',
    );
  });

  it('constrains tactics, basis points, and non-negative policy values', () => {
    expect(sql).toContain("default_tactic in ('pressure', 'flank', 'fortify', 'feint')");
    expect(sql).toContain('default_commit_bps between 0 and 10000');
    expect(sql).toContain('reserve_influence >= 0');
    expect(sql).toContain('auto_retreat_after_losses >= 0');
  });

  it('validates priority rules and requires city-backed territory slugs', () => {
    expect(sql).toContain('offline_defense_priority_rule_invalid');
    expect(sql).toContain('offline_defense_priority_rule_duplicate');
    expect(sql).toContain('offline_defense_priority_territory_not_found');
    expect(sql).toContain('territory.city_id = v_season.city_id');
  });

  it('writes policy and audit event atomically through an idempotent command', () => {
    expect(sql).toContain(
      'create or replace function public.grid_set_offline_defense_policy',
    );
    expect(sql).toContain("event_type <> 'grid:offline_defense_policy_set'");
    expect(sql).toContain('idempotency_key = p_idempotency_key');
    expect(sql).toContain('insert into public.grid_offline_defense_policies');
    expect(sql).toContain('on conflict (season_id, player_id) do update');
    expect(sql).toContain('insert into public.grid_game_events');
    expect(sql).toContain("'grid:offline_defense_policy_set'");
  });

  it('keeps policy mutation service-role only', () => {
    expect(sql).toContain(
      'revoke all on public.grid_offline_defense_policies from anon, authenticated',
    );
    expect(sql).toContain(
      'revoke all on function public.grid_set_offline_defense_policy',
    );
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain(
      'grant execute on function public.grid_set_offline_defense_policy',
    );
    expect(sql).toContain('to service_role');
    expect(sql).not.toContain('security definer');
  });

  it('requires a joined player and configurable season before saving', () => {
    expect(sql).toContain("status not in ('scheduled', 'active', 'surge')");
    expect(sql).toContain("raise exception 'season_not_configurable'");
    expect(sql).toContain("raise exception 'grid_player_not_joined'");
  });
});
