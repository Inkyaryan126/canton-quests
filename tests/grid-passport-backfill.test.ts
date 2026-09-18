import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918051000_grid_passport_home_city_backfill.sql'),
  'utf8',
);
const homeCityRoute = fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/onboarding/home-city/route.ts'),
  'utf8',
);

describe('Grid Passport existing Home City backfill', () => {
  it('touches only profiles that already have Home City but still have blank Passport state', () => {
    expect(migration).toContain('update public.grid_player_profiles');
    expect(migration).toContain('where home_city_id is not null');
    expect(migration).toContain("passport = '{}'::jsonb");
    expect(migration).not.toMatch(/set\s+updated_at\s*=/i);
  });

  it('creates the same one-stamp permanent history the live integration expects', () => {
    expect(migration).toContain("'version', 1");
    expect(migration).toContain("'citiesEntered', 1");
    expect(migration).toContain("'entriesRecorded', 1");
    expect(migration).toContain("'firstEnteredAt', updated_at");
    expect(migration).toContain("'lastEnteredAt', updated_at");
    expect(migration).toContain("'entryCount', 1");
    expect(migration).toContain("'isHomeCity', true");
  });

  it('shares the live Home City idempotency-key namespace so reconfirmation cannot double count', () => {
    expect(migration).toContain("'passport:home-city:%s:%s'");
    expect(homeCityRoute).toContain(
      '`passport:home-city:${session.player.id}:${homeCity.cityId}`',
    );
    expect(migration).toContain('where not exists');
    expect(migration).toContain('existing.season_id is null');
    expect(migration).toContain('existing.idempotency_key = format(');
  });

  it('adds an immutable backfilled city-entry event without touching seasonal economy', () => {
    expect(migration).toContain('insert into public.grid_game_events');
    expect(migration).toContain("'grid:passport_city_entered'");
    expect(migration).toContain("'backfilled', true");
    expect(migration).not.toContain('grid_player_season_state');
    expect(migration).not.toMatch(/\bcredits\b|\binfluence\b|command_points/i);
  });
});
