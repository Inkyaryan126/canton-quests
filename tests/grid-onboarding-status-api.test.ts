import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/onboarding/status/route.ts'),
  'utf8',
);
const adapter = fs.readFileSync(
  path.join(root, 'lib/grid/server/supabase-onboarding-status.ts'),
  'utf8',
);

describe('Grid onboarding status API contract', () => {
  it('is authenticated, read-only, and gated by Grid world reads', () => {
    expect(route).toContain('export async function GET');
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('Authentication required.');
    expect(route).toContain('isGridWorldReadEnabled()');
  });

  it('derives player identity from the authenticated session only', () => {
    expect(route).toContain('session.player.id');
    expect(route).not.toMatch(/request\.json|body\.playerId|playerId.*searchParams/);
  });

  it('keeps the Supabase adapter strictly read-only', () => {
    expect(adapter).toContain(".from('grid_player_profiles')");
    expect(adapter).toContain(".from('grid_player_season_state')");
    expect(adapter).toContain(".from('grid_game_events')");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });

  it('uses dedicated onboarding events instead of treating live PvP as tutorial completion', () => {
    expect(adapter).toContain("'grid:tutorial_contest_completed'");
    expect(adapter).toContain("'grid:onboarding_completed'");
    expect(adapter).not.toContain("'grid:contest_started'");
    expect(adapter).not.toContain("'grid:contest_session_round_resolved'");
  });

  it('requires starter-mode claim and positive Credits or Influence for income', () => {
    expect(adapter).toContain("event.payload?.claimMode === 'starter'");
    expect(adapter).toContain('event.payload?.creditsEarned');
    expect(adapter).toContain('event.payload?.influenceEarned');
    expect(adapter).not.toContain('commandPointsRegenerated');
  });
});
