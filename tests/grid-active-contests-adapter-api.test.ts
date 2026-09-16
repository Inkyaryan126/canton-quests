import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSupabaseGridActiveContestPort } from '../lib/grid/server/supabase-active-contests';

const adapterPath = path.join(
  process.cwd(),
  'lib/grid/server/supabase-active-contests.ts',
);
const routePath = path.join(
  process.cwd(),
  'app/api/grid/contests/active/route.ts',
);

function read(pathname: string): string {
  return fs.readFileSync(pathname, 'utf8');
}

describe('Grid active contest discovery adapter/API contract', () => {
  it('requires the trusted service-role adapter', () => {
    expect(() => createSupabaseGridActiveContestPort(null as any)).toThrow(
      'Grid active contest discovery requires Supabase service-role configuration',
    );
  });

  it('reads only active contests inside the requested season', () => {
    const source = read(adapterPath);
    expect(source).toContain(".eq('season_id', query.seasonId)");
    expect(source).toContain(".eq('status', 'active')");
    expect(source).toContain(".order('started_at', { ascending: false })");
  });

  it('supports participant and territory narrowing without changing mutation code', () => {
    const source = read(adapterPath);
    expect(source).toContain('attacker_player_id.eq.${query.playerId}');
    expect(source).toContain('defender_player_id.eq.${query.playerId}');
    expect(source).toContain('source_territory_id.eq.${query.territoryId}');
    expect(source).toContain('target_territory_id.eq.${query.territoryId}');
    expect(source).not.toContain('.rpc(');
  });

  it('keeps the HTTP read surface behind contest enablement and authentication', () => {
    const source = read(routePath);
    expect(source).toContain('isGridContestWriteEnabled()');
    expect(source).toContain('Authentication required.');
    expect(source).toContain("searchParams.get('seasonId')");
    expect(source).toContain("searchParams.get('playerId')");
    expect(source).toContain("searchParams.get('territoryId')");
  });
});
