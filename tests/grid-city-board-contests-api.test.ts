import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const launch = read('app/api/grid/contests/launch/route.ts');
const adapter = read('lib/grid/server/supabase-contest-board.ts');
const service = read('lib/grid/server/contest-board-service.ts');
const client = read('app/grid/grid-world-client.tsx');
const worldRoute = read('app/api/grid/world/route.ts');
const roundRoute = read('app/api/grid/contests/[contestId]/round/route.ts');

describe('Grid City Board contest API contract', () => {
  it('gates launch and round play behind contest writes and authentication', () => {
    expect(launch).toContain('isGridContestWriteEnabled()');
    expect(launch).toContain('resolveAuthenticatedSession');
    expect(launch).toContain('Authentication required.');
    expect(roundRoute).toContain('isGridContestWriteEnabled()');
    expect(worldRoute).toContain('contestWriteEnabled');
  });

  it('accepts only public territory slugs, influence choice, and idempotency from the board', () => {
    expect(launch).toContain('body.sourceTerritorySlug');
    expect(launch).toContain('body.targetTerritorySlug');
    expect(launch).toContain('body.attackerCommittedInfluence');
    expect(launch).toContain('body.idempotencyKey');
    expect(launch).not.toContain('body.attackerPlayerId');
    expect(launch).not.toContain('body.sourceTerritoryId');
    expect(launch).not.toContain('body.targetTerritoryId');
    expect(launch).not.toContain('body.defenderPlayerId');
    expect(launch).toContain('attackerPlayerId: session.player.id');
  });

  it('resolves territory IDs in a read-only adapter and sanitizes launch output', () => {
    expect(adapter).toContain(".from('grid_cities')");
    expect(adapter).toContain(".from('grid_territories')");
    expect(adapter).toContain(".in('slug', [sourceTerritorySlug, targetTerritorySlug])");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
    expect(service).toContain('launchGridContestAttack(');
    expect(service).toContain('sourceTerritorySlug: request.sourceTerritorySlug');
    expect(service).toContain('targetTerritorySlug: request.targetTerritorySlug');
    expect(service).not.toContain('defenderPlayerId: result');
    expect(service).not.toContain('eventId: result');
  });

  it('renders attack bands and active round controls without rival identity', () => {
    expect(client).toContain("fetch('/api/grid/contests/launch'");
    expect(client).toContain("'/api/grid/contests/' + contestId + '/round'");
    expect(client).toContain('territory.attackSourceSlugs.map');
    expect(client).toContain('projection.player.attackCommitOptions.map');
    expect(client).toContain('Roll next round');
    expect(client).toContain('OPPONENT:');
    expect(client).not.toContain('defenderPlayerId');
  });
});
