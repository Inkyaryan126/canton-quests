import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/passport/route.ts'),
  'utf8',
);
const adapter = fs.readFileSync(
  path.join(root, 'lib/grid/server/supabase-passport-read.ts'),
  'utf8',
);

describe('Grid Passport authenticated read API', () => {
  it('derives player identity from the authenticated session only', () => {
    expect(route).toContain('resolveAuthenticatedSession(request)');
    expect(route).toContain('session.player.id');
    expect(route).not.toContain('searchParams');
    expect(route).not.toContain('playerId =');
    expect(route).not.toContain('request.json()');
  });

  it('preserves refreshed auth and disables private cache storage', () => {
    expect(route).toContain(
      'setAuthCookies(result, session.refreshedSession, session.player?.id)',
    );
    expect(route).toContain("'Cache-Control', 'private, no-store, max-age=0'");
    expect(route).toContain("dynamic = 'force-dynamic'");
  });

  it('fails closed for staged runtime and unauthenticated callers', () => {
    expect(route).toContain('isGridWorldReadEnabled()');
    expect(route).toContain('{ status: 404 }');
    expect(route).toContain('{ status: 401 }');
  });

  it('reads only the global player profile cache, never city-local wealth', () => {
    expect(adapter).toContain(".from('grid_player_profiles')");
    expect(adapter).toContain(".select('passport,global_reputation')");
    expect(adapter).toContain(".eq('player_id', playerId)");
    expect(adapter).not.toContain('grid_player_season_state');
    expect(adapter).not.toContain('credits');
    expect(adapter).not.toContain('influence');
    expect(adapter).not.toContain('command_points');
    expect(adapter).not.toContain('city_power');
  });

  it('marks player-specific Passport responses private across cookie sessions', () => {
    expect(route).toContain("result.headers.set('Cache-Control', 'private, no-store, max-age=0')");
    expect(route).toContain("result.headers.set('Vary', 'Cookie')");
  });
});
