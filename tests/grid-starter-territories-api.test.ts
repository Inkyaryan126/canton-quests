import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/onboarding/starter-territories/route.ts'),
  'utf8',
);
const adapter = fs.readFileSync(
  path.join(root, 'lib/grid/server/supabase-starter-territories.ts'),
  'utf8',
);

describe('Grid starter territory API contract', () => {
  it('is authenticated, read-only, and gated by Grid world reads', () => {
    expect(route).toContain('export async function GET');
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('Authentication required.');
    expect(route).toContain('isGridWorldReadEnabled()');
  });

  it('derives the player from the authenticated session', () => {
    expect(route).toContain('session.player.id');
    expect(route).not.toMatch(/request\.json|body\.playerId|searchParams/);
  });

  it('keeps the Supabase adapter strictly read-only', () => {
    expect(adapter).toContain(".from('grid_player_season_state')");
    expect(adapter).toContain(".from('grid_season_territory_state')");
    expect(adapter).toContain(".from('grid_territories')");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });

  it('reduces ownership to an occupied boolean instead of exposing rival IDs', () => {
    expect(adapter).toContain('occupied: ownershipByTerritoryId.get(row.id) ?? false');
    expect(adapter).not.toContain('ownerPlayerId:');
  });

  it('checks that the runtime season is actually playable before offering choices', () => {
    expect(adapter).toContain("season.status === 'active'");
    expect(adapter).toContain("season.status === 'surge'");
  });
});
