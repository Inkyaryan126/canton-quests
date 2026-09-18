import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const feed = read('app/api/grid/onboarding/properties/route.ts');
const acquire = read('app/api/grid/onboarding/properties/acquire/route.ts');
const develop = read('app/api/grid/onboarding/properties/develop/route.ts');
const adapter = read('lib/grid/server/supabase-onboarding-property.ts');
const service = read('lib/grid/server/onboarding-property-service.ts');

describe('Grid onboarding property API contract', () => {
  it('keeps the property feed authenticated, read-only, and world-read gated', () => {
    expect(feed).toContain('export async function GET');
    expect(feed).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(feed).toContain('resolveAuthenticatedSession');
    expect(feed).toContain('isGridWorldReadEnabled()');
    expect(feed).toContain('session.player.id');
  });

  it('gates acquire and develop behind onboarding writes and authentication', () => {
    for (const route of [acquire, develop]) {
      expect(route).toContain('export async function POST');
      expect(route).toContain('isGridOnboardingWriteEnabled()');
      expect(route).toContain('resolveAuthenticatedSession');
      expect(route).toContain('Authentication required.');
    }
  });
  it('accepts only player choices from the browser, never authority fields', () => {
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
      expect(route).not.toContain('body.commandPointsSpent');
      expect(route).toContain('playerId: session.player.id');
      expect(route).toContain('now: new Date().toISOString()');
    }
  });

  it('resolves database property IDs through a read-only service-role adapter', () => {
    expect(adapter).toContain(".from('grid_cities')");
    expect(adapter).toContain(".from('grid_properties')");
    expect(adapter).toContain(".eq('slug', propertySlug)");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });
  it('reuses the proven atomic property services and sanitizes mutation results', () => {
    expect(service).toContain('acquireGridProperty(commandPort');
    expect(service).toContain('developGridProperty(commandPort');
    expect(service).toContain('resolvePropertyId(propertySlug)');
    expect(service).toContain('propertySlug: result.propertySlug');
    expect(service).not.toContain('eventId: result.eventId');
    expect(service).not.toContain('playerId: result.playerId');
  });
});
