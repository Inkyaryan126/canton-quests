import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260918010000_grid_alliance_persistence.sql',
);

function migrationSql(): string {
  return fs.existsSync(migrationPath)
    ? fs.readFileSync(migrationPath, 'utf8').toLowerCase()
    : '';
}

describe('GRID Alliance persistence schema', () => {
  it('persists seasonal Alliances and membership history', () => {
    const sql = migrationSql();
    expect(sql).toContain('create table public.grid_alliances');
    expect(sql).toContain('create table public.grid_alliance_memberships');
    expect(sql).toContain('references public.grid_seasons(id)');
    expect(sql).toContain('references public.players(id)');
  });

  it('enforces one active Alliance membership per player per season', () => {
    const sql = migrationSql();
    expect(sql).toContain('grid_alliance_memberships_active_player_season_uq');
    expect(sql).toContain('on public.grid_alliance_memberships (season_id, player_id)');
    expect(sql).toContain('where left_at is null');
  });

  it('binds each membership season to the same season as its Alliance', () => {
    const sql = migrationSql();
    expect(sql).toContain('unique (id, season_id)');
    expect(sql).toContain('foreign key (alliance_id, season_id)');
    expect(sql).toContain('references public.grid_alliances(id, season_id)');
  });

  it('stores only a bounded non-negative pooled Influence resource', () => {
    const sql = migrationSql();
    expect(sql).toContain('influence_pool integer not null default 0');
    expect(sql).toContain('check (influence_pool >= 0)');
    expect(sql).not.toMatch(/pooled_credits|credits_pool|command_points_pool/);
  });

  it('keeps cooldown history structurally consistent', () => {
    const sql = migrationSql();
    expect(sql).toContain('left_at is null and cooldown_until is null');
    expect(sql).toContain('cooldown_until >= left_at');
  });

  it('uses locked server-only RPCs for create, join, and leave mutations', () => {
    const sql = migrationSql();
    for (const fn of ['grid_create_alliance', 'grid_join_alliance', 'grid_leave_alliance']) {
      expect(sql).toContain(`create or replace function public.${fn}`);
      expect(sql).toContain(`grant execute on function public.${fn}`);
    }
    expect(sql).toContain('for update;');
    expect(sql).toContain('grid_alliance_cooldown_active');
    expect(sql).toContain('grid_alliance_full');
    expect(sql).toContain('grid_alliance_leader_cannot_leave');
  });

  it('keeps Alliance tables behind the trusted server boundary', () => {
    const sql = migrationSql();
    expect(sql).toContain('alter table public.grid_alliances enable row level security');
    expect(sql).toContain('alter table public.grid_alliance_memberships enable row level security');
    expect(sql).toContain('revoke all on public.grid_alliances from public, anon, authenticated');
    expect(sql).toContain('revoke all on public.grid_alliance_memberships from public, anon, authenticated');
  });
});
