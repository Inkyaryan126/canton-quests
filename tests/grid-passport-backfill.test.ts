import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260918052100_grid_passport_home_city_backfill.sql'), 'utf8');
describe('Canonical Grid Passport Home City backfill', () => {
  it('backfills only confirmed Home City profiles with blank caches', () => {
    expect(sql).toContain('profile.home_city_id is not null');
    expect(sql).toContain("profile.passport = '{}'::jsonb");
    expect(sql).toContain("existing_passport_event.event_type like 'grid:passport_%'");
    expect(sql).toContain("'grid:passport_home_city_set'");
    expect(sql).toContain("'homeCitySlug', candidate.city_slug");
    expect(sql).toContain("'citiesEntered', jsonb_build_array(candidate.city_slug)");
  });
  it('preserves replay parity for pre-existing nonzero reputation', () => {
    expect(sql).toContain("'grid:passport_reputation_earned'");
    expect(sql).toContain("'amount', global_reputation");
    expect(sql).toContain("'nationalReputation', candidate.global_reputation");
    expect(sql).toContain("1 + case when candidate.global_reputation > 0 then 1 else 0 end");
  });
});
