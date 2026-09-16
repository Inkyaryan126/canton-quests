import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260916023000_grid_contest_session_rounds.sql',
  ),
  'utf8',
);

describe('Grid persistent contest round command', () => {
  it('resolves rounds against escrowed remaining Influence', () => {
    expect(sql).toContain('v_contest.attacker_remaining_influence');
    expect(sql).toContain('v_contest.defender_remaining_influence');
    expect(sql).toContain('round_number = v_round_number');
  });

  it('keeps defender-favored tie comparison', () => {
    expect(sql).toContain('if v_attacker_roll > v_defender_roll then');
    expect(sql).toContain("'winner', 'defender'");
  });

  it('ends simultaneous exhaustion as defended and otherwise permits capture', () => {
    expect(sql).toContain('-- Defender wins simultaneous exhaustion / inability to continue.');
    expect(sql).toContain("v_status := 'defended'");
    expect(sql).toContain("v_status := 'captured'");
  });

  it('transfers only the target territory on a captured outcome', () => {
    expect(sql).toContain('update public.grid_season_territory_state');
    expect(sql).toContain('owner_player_id = v_contest.attacker_player_id');
    expect(sql).toContain('CONTEST_TARGET_OWNERSHIP_CHANGED');
  });

  it('refunds all surviving reserve when a contest reaches a terminal state', () => {
    expect(sql).toContain('influence = influence + v_attacker_refund');
    expect(sql).toContain('influence = influence + v_defender_refund');
  });

  it('records each round immutably and remains service-role only', () => {
    expect(sql).toContain("'grid:contest_session_round_resolved'");
    expect(sql).toContain('p_idempotency_key');
    expect(sql).toContain('grant execute on function public.grid_resolve_contest_session_round');
    expect(sql).toContain('to service_role;');
  });
});
