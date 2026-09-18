import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isGridAllianceEnabled } from '../lib/grid/server/feature-flags';

const route = (...parts: string[]) => fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/alliances', ...parts), 'utf8',
);
const root = route('route.ts');
const join = route('[allianceId]', 'join', 'route.ts');
const leave = route('[allianceId]', 'leave', 'route.ts');
const contribute = route('[allianceId]', 'contribute', 'route.ts');
const routes = [root, join, leave, contribute];

describe('GRID Alliance player API', () => {
  it('requires both foundation and Alliance feature flags', () => {
    expect(isGridAllianceEnabled({ GRID_FOUNDATION_ENABLED: '1', GRID_ALLIANCE_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isGridAllianceEnabled({ GRID_FOUNDATION_ENABLED: '1', GRID_ALLIANCE_ENABLED: '0' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isGridAllianceEnabled({ GRID_FOUNDATION_ENABLED: '0', GRID_ALLIANCE_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('keeps every player route authenticated and feature gated', () => {
    for (const source of routes) {
      expect(source).toContain('isGridAllianceEnabled()');
      expect(source).toContain('resolveAuthenticatedSession(request)');
      expect(source).toContain('Authentication required.');
      expect(source).toContain('resolveGridAllianceSeason');
    }
  });

  it('derives player, season, and new Alliance id server-side', () => {
    expect(root).toContain('randomUUID()');
    expect(root).toContain('leaderPlayerId: session.player.id');
    expect(join).toContain('playerId: session.player.id');
    expect(leave).toContain('playerId: session.player.id');
    expect(contribute).toContain('playerId: session.player.id');
    for (const source of routes) {
      expect(source).not.toMatch(/body\.(playerId|leaderPlayerId|seasonId|allianceId)/);
    }
  });

  it('keeps contribution balances and dice-like authority off the client payload', () => {
    expect(contribute).toContain('requestedInfluence');
    expect(contribute).toContain('idempotencyKey');
    expect(contribute).not.toMatch(/body\.(playerInfluence|poolInfluence|poolInfluenceAfter|acceptedInfluence)/);
  });

  it('does not expose system upkeep as a player mutation route', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/api/grid/alliances/upkeep/route.ts'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'app/api/grid/alliances/[allianceId]/upkeep/route.ts'))).toBe(false);
  });
});
