import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/return-summary/route.ts'),
  'utf8',
);
const adapter = fs.readFileSync(
  path.join(root, 'lib/grid/server/supabase-return-summary.ts'),
  'utf8',
);

describe('Grid return summary API contract', () => {
  it('is authenticated, read-only, and independently gated by Grid world reads', () => {
    expect(route).toContain('export async function GET');
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('Authentication required.');
    expect(route).toContain('isGridWorldReadEnabled()');
  });

  it('derives player identity and generated time only on the server', () => {
    expect(route).toContain('session.player.id');
    expect(route).toContain('new Date().toISOString()');
    expect(route).not.toMatch(/request\.json|playerId.*body|generatedAt.*body/);
  });

  it('keeps the Supabase adapter strictly read-only', () => {
    expect(adapter).toContain(".from('grid_game_events')");
    expect(adapter).toContain(".from('grid_contests')");
    expect(adapter).toContain(".from('grid_season_territory_state')");
    expect(adapter).toContain(".from('grid_season_property_state')");
    expect(adapter).toContain('credits_accrual_remainder');
    expect(adapter).toContain('influence_accrual_remainder');
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });

  it('returns sanitized activity records instead of raw event payloads', () => {
    expect(adapter).toContain('viewerRole');
    expect(adapter).toContain('contestOutcome');
    expect(adapter).not.toContain('payload: row.payload');
    expect(adapter).not.toContain('actorPlayerId: row.actor_player_id');
  });
});
