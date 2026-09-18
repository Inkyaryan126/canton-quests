import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const route = read('app/api/grid/onboarding/unlock/route.ts');
const service = read('lib/grid/server/onboarding-unlock-service.ts');
const adapter = read('lib/grid/server/supabase-onboarding-unlock.ts');

describe('Grid onboarding unlock API contract', () => {
  it('is authenticated and gated by onboarding writes', () => {
    expect(route).toContain('export async function POST');
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('isGridOnboardingWriteEnabled()');
    expect(route).toContain('Authentication required.');
  });

  it('accepts only an idempotency key from the browser', () => {
    expect(route).toContain('body.idempotencyKey');
    expect(route).not.toContain('body.playerId');
    expect(route).not.toContain('body.cityId');
    expect(route).not.toContain('body.seasonId');
    expect(route).toContain('playerId: session.player.id');
    expect(route).toContain('now: new Date().toISOString()');
  });
  it('requires the projected full-city unlock prerequisite before persistence', () => {
    expect(service).toContain('status.readyForFullCityUnlock');
    expect(service).toContain("status.nextStep?.id !== 'unlock-full-city'");
    expect(service).toContain(
      "'Grid onboarding unlock requires every first-session prerequisite'",
    );
  });

  it('persists only the onboarding completion event', () => {
    expect(service).toContain("eventType: 'grid:onboarding_completed'");
    expect(service).toContain("entityType: 'onboarding'");
    expect(service).toContain('fullCityUnlocked: true');
    expect(service).not.toContain('settleGridPlayerResources');
    expect(service).not.toContain('startGridContest');
  });

  it('resolves city and season through a read-only adapter', () => {
    expect(adapter).toContain(".from('grid_cities')");
    expect(adapter).toContain(".from('grid_seasons')");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });
});
