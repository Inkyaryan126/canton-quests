import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isGridOnboardingWriteEnabled } from '../lib/grid/server/onboarding-feature-flags';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/onboarding/join/route.ts'),
  'utf8',
);
const resolver = fs.readFileSync(
  path.join(root, 'lib/grid/server/supabase-onboarding-season.ts'),
  'utf8',
);

describe('Grid onboarding join API contract', () => {
  it('requires both foundation and onboarding write flags', () => {
    expect(
      isGridOnboardingWriteEnabled({
        GRID_FOUNDATION_ENABLED: '1',
        GRID_ONBOARDING_WRITE_ENABLED: '1',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);

    expect(
      isGridOnboardingWriteEnabled({
        GRID_FOUNDATION_ENABLED: '0',
        GRID_ONBOARDING_WRITE_ENABLED: '1',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);

    expect(
      isGridOnboardingWriteEnabled({
        GRID_FOUNDATION_ENABLED: '1',
        GRID_ONBOARDING_WRITE_ENABLED: '0',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('uses authenticated player identity and server command time', () => {
    expect(route).toContain('session.player.id');
    expect(route).toContain('new Date().toISOString()');
    expect(route).not.toMatch(/body\.playerId|body\.now/);
  });

  it('requires an idempotency key from the client', () => {
    expect(route).toContain('Missing idempotencyKey.');
    expect(route).toContain('body.idempotencyKey');
  });

  it('returns a sanitized wallet rather than internal city/player/season ids', () => {
    expect(route).toContain('player: result');
    expect(route).not.toContain('seasonId: result');
    expect(route).not.toContain('playerId: result');
    expect(route).not.toContain('cityId: result');
  });

  it('keeps season resolution read-only and service-role server side', () => {
    expect(resolver).toContain(".from('grid_cities')");
    expect(resolver).toContain(".from('grid_seasons')");
    expect(resolver).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });
});
