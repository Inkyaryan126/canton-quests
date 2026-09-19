import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260918110000_grid_season_archive.sql',
  ),
  'utf8',
).toLowerCase();

describe('Grid season archive persistence schema', () => {
  it('stores immutable season archive metadata and strict final standings', () => {
    expect(sql).toContain('create table public.grid_season_archives');
    expect(sql).toContain('create table public.grid_season_final_standings');
    expect(sql).toContain('primary key (season_id, player_id)');
    expect(sql).toContain('unique (season_id, final_rank)');
    expect(sql).toContain('city_power_bps integer not null');
    expect(sql).toContain('city_power_breakdown jsonb not null');
  });

  it('fails closed while live pvp or pve contests remain', () => {
    expect(sql).toContain('from public.grid_contests');
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('season_archive_active_pvp_contests');
    expect(sql).toContain('from public.grid_pve_stronghold_contests');
    expect(sql).toContain('season_archive_active_pve_contests');
  });

  it('blocks archive while completed contract rewards remain unpaid', () => {
    expect(sql).toContain('from public.grid_contract_reward_outbox');
    expect(sql).toContain('processed_at is null');
    expect(sql).toContain('season_archive_pending_contract_rewards');
  });

  it('reuses existing atomic commands to clean up end-of-season commitments', () => {
    expect(sql).toContain('public.grid_settle_property_auction(');
    expect(sql).toContain('public.grid_cancel_fixed_price_property_listing(');
    expect(sql).toContain('public.grid_cancel_direct_deal_proposal(');
    expect(sql).toContain("'grid:contract_expired'");
    expect(sql).toContain("'reason', 'season-ended'");
  });

  it('requires one ordered standing for every joined season player', () => {
    expect(sql).toContain('from public.grid_player_season_state');
    expect(sql).toContain('season_archive_standings_count_mismatch');
    expect(sql).toContain('season_archive_rank_sequence_invalid');
    expect(sql).toContain('season_archive_player_not_joined');
    expect(sql).toContain('set city_power = v_city_power_bps');
  });

  it('writes permanent passport rank, podium, champion, and territory records', () => {
    expect(sql).toContain("'grid:passport_city_rank_recorded'");
    expect(sql).toContain("'grid:passport_seasonal_trophy_earned'");
    expect(sql).toContain("'grid:passport_championship_earned'");
    expect(sql).toContain("'grid:passport_territory_control_recorded'");
    expect(sql).toContain('from public.grid_season_territory_state');
  });

  it('marks the season archived only inside the same archive transaction', () => {
    const finalStanding = sql.indexOf(
      'insert into public.grid_season_final_standings',
    );
    const archiveRow = sql.indexOf('insert into public.grid_season_archives');
    const statusUpdate = sql.lastIndexOf(
      "update public.grid_seasons\n     set status = 'archived'",
    );
    const archiveEvent = sql.lastIndexOf("'grid:season_archived'");

    expect(finalStanding).toBeGreaterThan(0);
    expect(archiveRow).toBeGreaterThan(finalStanding);
    expect(statusUpdate).toBeGreaterThan(archiveRow);
    expect(archiveEvent).toBeGreaterThan(statusUpdate);
  });

  it('keeps archive writes service-role only with RLS enabled', () => {
    expect(sql).toContain(
      'alter table public.grid_season_archives enable row level security',
    );
    expect(sql).toContain(
      'alter table public.grid_season_final_standings enable row level security',
    );
    expect(sql).toContain(
      'revoke all on function public.grid_archive_season',
    );
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });

  it('uses the immutable event ledger for command idempotency', () => {
    expect(sql).toContain('where season_id = p_season_id');
    expect(sql).toContain('and idempotency_key = p_idempotency_key');
    expect(sql).toContain("'grid:season_archived'");
    expect(sql).toContain('idempotency_key_collision');
  });
});
