import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260916043000_grid_contest_auto_retreat.sql',
  ),
  'utf8',
);

describe('Grid contest auto-retreat capture schema', () => {
  it('defines one service-role-only atomic capture command', () => {
    expect(sql).toContain('grid_capture_territory_by_auto_retreat');
    expect(sql).toContain('grant execute on function public.grid_capture_territory_by_auto_retreat');
    expect(sql).toContain('to service_role;');
    expect(sql).toContain('from public, anon, authenticated;');
  });

  it('revalidates season, adjacency, and both ownership sides before capture', () => {
    expect(sql).toContain("v_season.status not in ('active', 'surge')");
    expect(sql).toContain('CONTEST_TERRITORIES_NOT_ADJACENT');
    expect(sql).toContain('SOURCE_TERRITORY_NOT_OWNED_BY_ATTACKER');
    expect(sql).toContain('TARGET_TERRITORY_NOT_OWNED_BY_DEFENDER');
    expect(sql).toContain('TARGET_ALREADY_CONTESTED');
  });

  it('settles both players before ownership transfer', () => {
    expect(sql.match(/grid_settle_player_resources/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).toContain('owner_player_id = p_attacker_player_id');
    expect(sql).toContain('CONTEST_TARGET_OWNERSHIP_CHANGED');
  });

  it('records the server doctrine decision in the immutable event ledger', () => {
    expect(sql).toContain("'grid:contest_auto_retreat_capture'");
    expect(sql).toContain("'defenseDoctrineId'");
    expect(sql).toContain("'defenseReason'");
    expect(sql).toContain("'defenseTactic'");
    expect(sql).toContain('p_idempotency_key');
  });
});
