import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918072000_grid_npc_runtime_evidence.sql'),
  'utf8',
);
describe('Grid NPC runtime evidence schema', () => {
  it('stores Surge, faction pressure, and event activation separately', () => {
    expect(sql).toContain('create table public.grid_npc_season_runtime_state');
    expect(sql).toContain('create table public.grid_npc_faction_pressure_state');
    expect(sql).toContain('create table public.grid_npc_stronghold_event_state');
  });
  it('keeps Surge intensity nullable so unknown never becomes zero', () => {
    expect(sql).toMatch(/surge_intensity_bps integer\s+check \(surge_intensity_bps is null/s);
    expect(sql).not.toMatch(/surge_intensity_bps integer[^;]*default 0/s);
  });
  it('binds event evidence to registered season strongholds', () => {
    expect(sql).toContain('references public.grid_npc_stronghold_definitions(season_id, stronghold_id)');
  });
  it('seeds no invented runtime values and blocks browser mutation', () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.grid_npc_/i);
    expect(sql.match(/enable row level security/g)?.length).toBe(3);
    expect(sql.match(/revoke insert, update, delete/g)?.length).toBe(3);
  });
});
