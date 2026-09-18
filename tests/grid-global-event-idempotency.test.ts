import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const foundation = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260912052232_grid_foundation.sql'),
  'utf8',
);
const hardening = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918052000_grid_global_event_idempotency.sql'),
  'utf8',
);
const passport = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918050000_grid_passport_city_entry.sql'),
  'utf8',
);

describe('Grid global event idempotency', () => {
  it('keeps the original season-scoped composite idempotency index', () => {
    expect(foundation).toContain('create unique index grid_game_events_idempotency_uq');
    expect(foundation).toContain('on public.grid_game_events (season_id, idempotency_key)');
  });

  it('adds a separate unique boundary for seasonless permanent events', () => {
    expect(hardening).toContain('create unique index if not exists grid_game_events_global_idempotency_uq');
    expect(hardening).toContain('on public.grid_game_events (idempotency_key)');
    expect(hardening).toContain('where season_id is null');
    expect(hardening).toContain('and idempotency_key is not null');
  });

  it('fails closed if duplicate global keys already exist instead of rewriting immutable history', () => {
    expect(hardening).toContain('group by idempotency_key');
    expect(hardening).toContain('having count(*) > 1');
    expect(hardening).toContain('GRID_GLOBAL_EVENT_IDEMPOTENCY_DUPLICATES_EXIST');
    expect(hardening).not.toMatch(/delete\s+from\s+public\.grid_game_events/i);
    expect(hardening).not.toMatch(/update\s+public\.grid_game_events/i);
  });

  it('protects Passport city-entry events because they are intentionally seasonless', () => {
    expect(passport).toContain("'grid:passport_city_entered'");
    expect(passport).toMatch(/p_city_id,\s*\n\s*null,\s*\n\s*p_player_id,/);
    expect(passport).toContain('p_idempotency_key');
  });
});
