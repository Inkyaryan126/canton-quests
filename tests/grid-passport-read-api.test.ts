import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(path.join(process.cwd(), 'app/api/grid/passport/route.ts'), 'utf8');
const adapter = fs.readFileSync(path.join(process.cwd(), 'lib/grid/server/supabase-passport-read.ts'), 'utf8');

describe('Grid Passport read API contract', () => {
  it('is authenticated, read-only, and foundation gated', () => {
    expect(route).toContain('export async function GET');
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(route).toContain('resolveAuthenticatedSession(request)');
    expect(route).toContain('session.player.id');
    expect(route).toContain('Authentication required.');
    expect(route).toContain('isGridFoundationEnabled()');
    expect(route).not.toMatch(/request\.json\(/);
  });

  it('reads only permanent profile state and never seasonal economy tables', () => {
    expect(adapter).toContain(".from('grid_player_profiles')");
    expect(adapter).toContain(".select('home_city_id,global_reputation,passport')");
    expect(adapter).toContain(".from('grid_cities')");
    expect(adapter).toContain(".select('id,slug,name,region_code,country_code')");
    expect(adapter).not.toContain('grid_player_season_state');
    expect(adapter).not.toContain('grid_game_events');
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });
  it('marks every Passport response private and non-cacheable across players', () => {
    expect(route).toContain("response.headers.set('cache-control', 'private, no-store, max-age=0')");
    expect(route).toContain("response.headers.set('vary', 'Cookie')");
    expect(route.indexOf("response.headers.set('cache-control'")).toBeLessThan(
      route.indexOf('setAuthCookies(response'),
    );
  });

});
