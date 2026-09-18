import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const listRoute = fs.readFileSync(path.join(root, 'app/api/grid/contracts/route.ts'), 'utf8');
const detailRoute = fs.readFileSync(path.join(root, 'app/api/grid/contracts/[contractId]/route.ts'), 'utf8');
const adapter = fs.readFileSync(path.join(root, 'lib/grid/server/supabase-contract-read.ts'), 'utf8');

describe('Grid authenticated Contract read API', () => {
  it('derives player identity from the authenticated session only', () => {
    for (const route of [listRoute, detailRoute]) {
      expect(route).toContain('resolveAuthenticatedSession(request)');
      expect(route).toContain('session.player.id');
      expect(route).not.toContain('playerId =');
      expect(route).not.toContain('request.json()');
      expect(route).toContain("setAuthCookies(result, session.refreshedSession, session.player?.id)");
      expect(route).toContain("'Cache-Control', 'private, no-store, max-age=0'");
      expect(route).toContain("'Vary', 'Cookie'");
      expect(route).toContain("dynamic = 'force-dynamic'");
      expect(route).toContain('isGridWorldReadEnabled()');
      expect(route).toContain('{ status: 401 }');
    }
  });

  it('uses player, city, season, and contract filters at the private persistence boundary', () => {
    expect(adapter).toContain(".from('grid_contract_instances')");
    expect(adapter).toContain(".from('grid_contract_definitions')");
    expect(adapter).toContain(".eq('player_id', scope.playerId)");
    expect(adapter).toContain(".eq('city_id', scope.cityId)");
    expect(adapter).toContain(".eq('season_id', scope.seasonId)");
    expect(adapter).toContain(".eq('contract_id', scope.contractId)");
    expect(adapter).toContain(".eq('status', 'active')");
    expect(adapter).not.toContain('insert(');
    expect(adapter).not.toContain('update(');
    expect(adapter).not.toContain('rpc(');
  });

  it('does not expose client-writable progress or caller-supplied player selectors', () => {
    for (const route of [listRoute, detailRoute]) {
      expect(route).not.toMatch(/searchParams\.get\(['"]playerId/);
      expect(route).not.toMatch(/body\.playerId/);
    }
    expect(listRoute).not.toContain('POST');
    expect(detailRoute).not.toContain('POST');
  });
});
