import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/onboarding/home-city/route.ts'),
  'utf8',
);
const adapter = fs.readFileSync(
  path.join(root, 'lib/grid/server/supabase-onboarding-home-city.ts'),
  'utf8',
);

describe('Grid onboarding Home City API contract', () => {
  it('is authenticated and guarded by onboarding writes', () => {
    expect(route).toContain('export async function POST');
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('Authentication required.');
    expect(route).toContain('isGridOnboardingWriteEnabled()');
  });

  it('derives player, city, and time on the server', () => {
    expect(route).toContain('session.player.id');
    expect(route).toContain('new Date().toISOString()');
    expect(route).not.toMatch(/request\.json|body\.playerId|body\.cityId/);
    expect(adapter).toContain(".eq('slug', pkg.city.slug)");
  });

  it('will not silently overwrite a different existing Home City', () => {
    expect(adapter).toContain('GRID_HOME_CITY_ALREADY_SET');
    expect(adapter).toContain('existingHomeCityId !== cityId');
  });

  it('upserts only the authenticated player profile with server-resolved city', () => {
    expect(adapter).toContain(".from('grid_player_profiles')");
    expect(adapter).toContain('.upsert(');
    expect(adapter).toContain('player_id: playerId');
    expect(adapter).toContain('home_city_id: cityId');
    expect(adapter).toContain('updated_at: now');
  });

  it('uses internal city identity only between trusted server services and sanitizes the response', () => {
    expect(route).toContain('cityId: homeCity.cityId');
    expect(route).toContain('homeCity: { citySlug: homeCity.citySlug, confirmed: homeCity.confirmed }');
    expect(route).not.toContain('return response({ success: true, homeCity });');
  });
});
