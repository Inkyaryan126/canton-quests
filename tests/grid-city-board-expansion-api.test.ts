import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const route = read('app/api/grid/territories/claim/route.ts');
const adapter = read('lib/grid/server/supabase-territory-action.ts');
const service = read('lib/grid/server/territory-action-service.ts');
const client = read('app/grid/grid-world-client.tsx');
const worldRoute = read('app/api/grid/world/route.ts');

describe('Grid City Board expansion API contract', () => {
  it('uses a dedicated economy write gate and authenticated player identity', () => {
    expect(route).toContain('isGridEconomyWriteEnabled()');
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('Authentication required.');
    expect(worldRoute).toContain('economyWriteEnabled');
  });

  it('accepts only territory slug and idempotency key from the browser', () => {
    expect(route).toContain('body.territorySlug');
    expect(route).toContain('body.idempotencyKey');
    expect(route).not.toContain('body.playerId');
    expect(route).not.toContain('body.seasonId');
    expect(route).not.toContain('body.territoryId');
    expect(route).not.toContain('body.creditsSpent');
    expect(route).toContain('playerId: session.player.id');
    expect(route).toContain('now: new Date().toISOString()');
  });

  it('resolves database IDs in a read-only adapter and reuses the atomic claim service', () => {
    expect(adapter).toContain(".from('grid_cities')");
    expect(adapter).toContain(".from('grid_seasons')");
    expect(adapter).toContain(".from('grid_territories')");
    expect(adapter).toContain(".eq('slug', territorySlug)");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
    expect(service).toContain('claimNeutralGridTerritory(claimPort');
  });

  it('renders server-projected costs and submits no mutation authority from the City Board', () => {
    expect(client).toContain("fetch('/api/grid/territories/claim'");
    expect(client).toContain('territory.claimCost.credits');
    expect(client).toContain('territory.claimCost.commandPoints');
    expect(client).toContain('!economyWriteEnabled');
    expect(client).toContain('Claim territory');
    expect(client).not.toContain('territoryId');
    expect(client).not.toContain('seasonId');
  });
});
