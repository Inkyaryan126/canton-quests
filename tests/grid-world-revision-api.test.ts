import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/world/revision/route.ts'),
  'utf8',
);
const adapter = fs.readFileSync(
  path.join(root, 'lib/grid/server/supabase-world-revision.ts'),
  'utf8',
);

describe('Grid world revision API contract', () => {
  it('is an authenticated read-only endpoint behind the existing world read gate', () => {
    expect(route).toContain('export async function GET');
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('Authentication required.');
    expect(route).toContain('isGridWorldReadEnabled()');
    expect(route).not.toMatch(/request\.json\(/);
  });

  it('supports lightweight conditional polling with ETag and 304 responses', () => {
    expect(route).toContain("request.headers.get('if-none-match')");
    expect(route).toContain('status: 304');
    expect(route).toContain('etag');
    expect(route).toContain('x-grid-poll-after-ms');
    expect(route).toContain("'cache-control': 'private, no-cache, max-age=0'");
  });

  it('keeps persistence read-only and reads only the newest event cursor', () => {
    expect(adapter).toContain(".from('grid_cities')");
    expect(adapter).toContain(".from('grid_seasons')");
    expect(adapter).toContain(".from('grid_game_events')");
    expect(adapter).toContain(".select('id,created_at')");
    expect(adapter).toContain('.limit(1)');
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });

  it('does not return raw event payloads or player identifiers', () => {
    expect(adapter).not.toContain('payload');
    expect(adapter).not.toContain('actor_player_id');
    expect(route).not.toContain('playerId:');
  });
});
