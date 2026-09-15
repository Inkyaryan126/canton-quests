import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function sql(): string {
  const file = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260914180000_grid_property_commands.sql',
  );
  if (!fs.existsSync(file)) throw new Error('Grid property command migration not found');
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('GRID property command SQL contract', () => {
  it('defines service-role-only security-invoker property RPCs', () => {
    const text = sql();
    expect(text).toContain('create or replace function public.grid_acquire_property');
    expect(text).toContain('create or replace function public.grid_develop_property');
    expect(text.match(/security invoker/g)?.length).toBe(2);
    expect(text).not.toContain('security definer');
    expect(text).toContain('from public, anon, authenticated');
    expect(text).toContain('to service_role');
  });

  it('settles resources before acquisition and development spending', () => {
    const text = sql();
    expect(text).toContain("'preacquire:' || p_idempotency_key");
    expect(text).toContain("'predevelop:' || p_idempotency_key");
    expect(text.match(/grid_settle_player_resources/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it('enforces containing-territory control when configuration requires it', () => {
    const text = sql();
    expect(text).toContain('requireterritorycontrol');
    expect(text).toContain('public.grid_season_territory_state');
    expect(text).toContain("raise exception 'containing_territory_not_controlled'");
  });

  it('uses configured per-property acquisition costs without a formula', () => {
    const text = sql();
    expect(text).toContain('costbypropertyslug');
    expect(text).toContain('{defaultcost,credits}');
    expect(text).toContain('{defaultcost,commandpoints}');
    expect(text).toContain("raise exception 'insufficient_credits'");
    expect(text).toContain("raise exception 'insufficient_command_points'");
  });

  it('locks development to the five universal branches and configured next levels', () => {
    const text = sql();
    for (const branch of ['commerce', 'influence', 'fortress', 'intel', 'prestige']) {
      expect(text).toContain(`'${branch}'`);
    }
    expect(text).toContain("raise exception 'development_branch_locked'");
    expect(text).toContain("raise exception 'development_level_not_configured'");
    expect(text).toContain("v_next_level := v_previous_level + 1");
    expect(text).toContain("v_level_config #>> '{cost,credits}'");
  });
  it('writes property mutation events atomically after wallet/state updates', () => {
    const text = sql();
    const walletUpdate = text.indexOf('update public.grid_player_season_state');
    const propertyUpdate = text.indexOf('update public.grid_season_property_state');
    const acquiredEvent = text.lastIndexOf("'grid:property_acquired'");
    expect(walletUpdate).toBeGreaterThan(-1);
    expect(propertyUpdate).toBeGreaterThan(walletUpdate);
    expect(acquiredEvent).toBeGreaterThan(propertyUpdate);
    expect(text).toContain("'grid:property_developed'");
  });

  it('derives Skyline transitions from configured topology/rules inside development', () => {
    const text = sql();
    expect(text).toContain('with recursive');
    expect(text).toContain('public.grid_territory_edges');
    expect(text).toContain("'{skyline,rules}'");
    expect(text).toContain("'single-branch'");
    expect(text).toContain("'mixed'");
    expect(text).toContain("'grid:skyline_formed'");
    expect(text).toContain("'skyline:' || p_idempotency_key");
    expect(text).toContain('causation_id');
  });

  it('checks command idempotency before any pre-command settlement', () => {
    const text = sql();
    const firstIdempotency = text.indexOf('idempotency_key = p_idempotency_key');
    expect(firstIdempotency).toBeGreaterThan(-1);
    expect(firstIdempotency).toBeLessThan(text.indexOf('grid_settle_player_resources'));
  });
});