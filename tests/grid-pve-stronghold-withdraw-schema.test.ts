import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918074000_grid_pve_stronghold_withdraw.sql'),
  'utf8',
);
describe('Grid PvE stronghold withdraw schema', () => {
  it('extends terminal status with withdrawn without weakening existing outcomes', () => {
    expect(sql).toContain("status in ('active', 'captured', 'repelled', 'withdrawn')");
  });
  it('refunds only surviving attacker Influence and never writes target ownership', () => {
    expect(sql).toContain('influence = influence + v_contest.attacker_remaining_influence');
    expect(sql).not.toContain('garrison_refund');
    expect(sql).not.toContain('update public.grid_season_territory_state');
  });
  it('requires active contest and the authenticated attacker', () => {
    expect(sql).toContain("v_contest.status <> 'active'");
    expect(sql).toContain('PVE_CONTEST_WITHDRAW_NOT_ATTACKER');
  });
  it('is idempotent and appends an immutable withdrawal event', () => {
    expect(sql).toContain("'grid:pve_stronghold_contest_withdrawn'");
    expect(sql).toContain('IDEMPOTENCY_KEY_COLLISION');
    expect(sql).not.toMatch(/update\s+public\.grid_game_events/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.grid_game_events/i);
  });
  it('does not require an active season just to release escrow', () => {
    expect(sql).not.toContain('SEASON_NOT_ACTIVE');
    expect(sql).not.toContain("v_season.status not in ('active', 'surge')");
  });
  it('restricts execution to service_role', () => {
    expect(sql).toContain('revoke all on function public.grid_withdraw_pve_stronghold_contest');
    expect(sql).toContain('to service_role;');
  });
});
