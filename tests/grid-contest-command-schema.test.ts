import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260916004500_grid_contest_rounds.sql',
);
const sql = fs.readFileSync(migrationPath, 'utf8');

describe('Grid contest round command schema', () => {
  it('defines one atomic service-role-only round resolver', () => {
    expect(sql).toContain('create or replace function public.grid_resolve_contest_round');
    expect(sql).toContain('grant execute on function public.grid_resolve_contest_round');
    expect(sql).toContain('to service_role;');
    expect(sql).toContain('from public, anon, authenticated;');
  });

  it('requires active season contest configuration and defender-favored ties', () => {
    expect(sql).toContain("v_season.status not in ('active', 'surge')");
    expect(sql).toContain("v_contest := v_season.config -> 'contest'");
    expect(sql).toContain("coalesce(v_contest ->> 'tiesFavorDefender', '') <> 'true'");
  });

  it('requires adjacent attacker-owned and defender-owned territory', () => {
    expect(sql).toContain('CONTEST_TERRITORIES_NOT_ADJACENT');
    expect(sql).toContain('SOURCE_TERRITORY_NOT_OWNED_BY_ATTACKER');
    expect(sql).toContain('TARGET_TERRITORY_NOT_OWNED_BY_DEFENDER');
  });

  it('validates server-supplied dice against configured Signal Dice bands', () => {
    expect(sql).toContain("v_contest -> 'attacker' -> 'bands'");
    expect(sql).toContain("v_contest -> 'defender' -> 'bands'");
    expect(sql).toContain('CONTEST_DICE_COUNT_INVALID');
    expect(sql).toContain('CONTEST_DIE_RESULT_INVALID');
    expect(sql).toContain('if v_attacker_roll > v_defender_roll then');
  });

  it('charges only resolved Influence losses and appends an immutable event', () => {
    expect(sql).toContain('set influence = influence - v_attacker_loss');
    expect(sql).toContain('set influence = influence - v_defender_loss');
    expect(sql).toContain("'grid:contest_round_resolved'");
    expect(sql).toContain('p_idempotency_key');
  });

  it('does not transfer territory during a single round', () => {
    expect(sql).not.toMatch(/update\s+public\.grid_season_territory_state\s+set/i);
    expect(sql).not.toContain("'grid:territory_captured'");
  });
});
