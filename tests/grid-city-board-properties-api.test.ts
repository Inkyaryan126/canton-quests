import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const acquire = read('app/api/grid/properties/acquire/route.ts');
const develop = read('app/api/grid/properties/develop/route.ts');
const adapter = read('lib/grid/server/supabase-property-action.ts');
const service = read('lib/grid/server/property-action-service.ts');
const client = read('app/grid/grid-world-client.tsx');

describe('Grid City Board property API contract', () => {
  it('gates both mutations behind economy writes and authentication', () => {
    for (const route of [acquire, develop]) {
      expect(route).toContain('isGridEconomyWriteEnabled()');
      expect(route).toContain('resolveAuthenticatedSession');
      expect(route).toContain('Authentication required.');
    }
  });

  it('accepts only player choices from the browser', () => {
    expect(acquire).toContain('body.propertySlug');
    expect(acquire).toContain('body.idempotencyKey');
    expect(develop).toContain('body.propertySlug');
    expect(develop).toContain('body.branch');
    expect(develop).toContain('body.idempotencyKey');

    for (const route of [acquire, develop]) {
      expect(route).not.toContain('body.playerId');
      expect(route).not.toContain('body.seasonId');
      expect(route).not.toContain('body.propertyId');
      expect(route).not.toContain('body.creditsSpent');
      expect(route).toContain('playerId: session.player.id');
      expect(route).toContain('now: new Date().toISOString()');
    }
  });

  it('resolves property IDs in a read-only adapter and reuses atomic property services', () => {
    expect(adapter).toContain(".from('grid_cities')");
    expect(adapter).toContain(".from('grid_seasons')");
    expect(adapter).toContain(".from('grid_properties')");
    expect(adapter).toContain(".eq('slug', propertySlug)");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
    expect(service).toContain('acquireGridProperty(commandPort');
    expect(service).toContain('developGridProperty(commandPort');
  });

  it('renders projected property costs and branch choices without raw authority IDs', () => {
    expect(client).toContain("fetch('/api/grid/properties/acquire'");
    expect(client).toContain("fetch('/api/grid/properties/develop'");
    expect(client).toContain('property.acquisitionCost.credits');
    expect(client).toContain('property.developmentOptions.map');
    expect(client).toContain('option.cost.credits');
    expect(client).toContain('option.affordable');
    expect(client).not.toContain('propertyId');
    expect(client).not.toContain('seasonId');
  });
});
