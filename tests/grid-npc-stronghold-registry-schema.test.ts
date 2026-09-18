import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918071000_grid_npc_stronghold_registry.sql'),
  'utf8',
);
describe('Grid NPC stronghold registry schema', () => {
  it('stores season-scoped definitions but seeds no launch tuning', () => {
    expect(sql).toContain('create table public.grid_npc_stronghold_definitions');
    expect(sql).toContain('enabled boolean not null default false');
    expect(sql).not.toMatch(/insert\s+into\s+public\.grid_npc_stronghold_definitions/i);
  });
  it('validates real territory and optional landmark identity', () => {
    expect(sql).toContain('grid_validate_npc_stronghold_definition');
    expect(sql).toContain('NPC_STRONGHOLD_TERRITORY_CITY_MISMATCH');
    expect(sql).toContain('NPC_STRONGHOLD_LANDMARK_CITY_MISMATCH');
    expect(sql).toContain('NPC_STRONGHOLD_LANDMARK_TERRITORY_MISMATCH');
  });
  it('permits only one enabled stronghold target per season', () => {
    expect(sql).toContain('grid_npc_stronghold_enabled_target_uq');
    expect(sql).toContain('on public.grid_npc_stronghold_definitions (season_id, territory_id)');
    expect(sql).toContain('where enabled');
  });
  it('keeps browser roles from mutating definitions', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke insert, update, delete on public.grid_npc_stronghold_definitions from anon, authenticated');
  });
});
