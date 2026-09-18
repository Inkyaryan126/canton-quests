import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/onboarding/home-city/route.ts'),
  'utf8',
);

describe('Grid Passport Home City entry integration', () => {
  it('records the Passport entry only after authoritative Home City confirmation', () => {
    const confirmIndex = route.indexOf('await confirmGridOnboardingHomeCity(');
    const passportIndex = route.indexOf('await recordGridPassportCityEntry(');
    expect(confirmIndex).toBeGreaterThan(-1);
    expect(passportIndex).toBeGreaterThan(confirmIndex);
    expect(route).toContain('createSupabaseGridPassportPersistencePort()');
  });

  it('derives player, city, timestamp, and retry identity entirely on the server', () => {
    expect(route).toContain('const now = new Date().toISOString();');
    expect(route).toContain('playerId: session.player.id');
    expect(route).toContain('cityId: homeCity.cityId');
    expect(route).toContain('enteredAt: now');
    expect(route).toContain('`passport:home-city:${session.player.id}:${homeCity.cityId}`');
    expect(route).not.toMatch(/request\.json\(|body\.(cityId|playerId|enteredAt|idempotencyKey)/);
  });

  it('keeps the internal city UUID and Passport event details out of the browser response', () => {
    expect(route).toContain(
      'homeCity: { citySlug: homeCity.citySlug, confirmed: homeCity.confirmed }',
    );
    expect(route).not.toContain('passportEntry:');
    expect(route).not.toContain('eventId:');
  });
});
