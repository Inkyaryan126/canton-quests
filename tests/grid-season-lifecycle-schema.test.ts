import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260919120000_grid_season_lifecycle.sql',
  ),
  'utf8',
).toLowerCase();

describe('Grid season lifecycle persistence contract', () => {
  it('locks the season row before deriving or mutating state', () => {
    expect(sql).toContain('from public.grid_seasons');
    expect(sql).toContain('for update');
  });

  it('never auto-starts draft or mutates complete/archived seasons', () => {
    expect(sql).toContain(
      "if v_previous_status in ('draft', 'complete', 'archived')",
    );
  });

  it('derives missing Surge timing from persisted ends_at and configured hours', () => {
    expect(sql).toContain('make_interval(hours => p_surge_hours)');
    expect(sql).toContain('greatest(');
    expect(sql).toContain('v_season.ends_at');
  });

  it('can skip missed phases but never regress a persisted season', () => {
    expect(sql).toContain("v_desired_status := 'complete'");
    expect(sql).toContain("v_desired_status := 'surge'");
    expect(sql).toContain("v_desired_status := 'active'");
    expect(sql).toContain('if v_desired_rank <= v_current_rank then');
  });

  it('updates status and writes an immutable audit event in one transaction', () => {
    const update = sql.indexOf('update public.grid_seasons');
    const event = sql.indexOf('insert into public.grid_game_events');
    expect(update).toBeGreaterThan(0);
    expect(event).toBeGreaterThan(update);
    expect(sql).toContain("'grid:season_status_reconciled'");
    expect(sql).toContain("'previousstatus'");
    expect(sql).toContain("'status'");
  });

  it('uses deterministic per-target idempotency and service-role-only execution', () => {
    expect(sql).toContain("'season-lifecycle:'");
    expect(sql).toContain('idempotency_key = v_idempotency_key');
    expect(sql).toContain(
      'revoke all on function public.grid_reconcile_season_lifecycle',
    );
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });
});
