import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918073000_grid_npc_runtime_commands.sql'),
  'utf8',
);
describe('Grid NPC runtime command schema', () => {
  it('defines all three service-role command RPCs', () => {
    expect(sql).toContain('grid_set_npc_surge_intensity');
    expect(sql).toContain('grid_set_npc_faction_pressure');
    expect(sql).toContain('grid_set_npc_stronghold_event_state');
    expect(sql.match(/to service_role;/g)?.length).toBe(3);
    expect(sql.match(/from public, anon, authenticated;/g)?.length).toBe(3);
  });
  it('serializes each logical signal and rejects stale writes', () => {
    expect(sql.match(/pg_catalog\.pg_advisory_xact_lock/g)?.length).toBe(3);
    expect(sql.match(/NPC_RUNTIME_STALE_WRITE/g)?.length).toBe(3);
    expect(sql).toContain('npc-runtime:surge:');
    expect(sql).toContain('npc-runtime:faction:');
    expect(sql).toContain('npc-runtime:stronghold:');
  });
  it('writes immutable audit events and checks exact idempotency payloads', () => {
    expect(sql).toContain("'grid:npc_surge_intensity_set'");
    expect(sql).toContain("'grid:npc_faction_pressure_set'");
    expect(sql).toContain("'grid:npc_stronghold_event_set'");
    expect(sql.match(/IDEMPOTENCY_KEY_COLLISION/g)?.length).toBe(3);
    expect(sql).not.toMatch(/update\s+public\.grid_game_events/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.grid_game_events/i);
  });
  it('validates stronghold event writes against the canonical registry', () => {
    expect(sql).toContain('from public.grid_npc_stronghold_definitions');
    expect(sql).toContain('NPC_STRONGHOLD_DEFINITION_NOT_FOUND');
    expect(sql).toContain("'npc_stronghold', v_definition.id");
  });
  it('allows Surge evidence to be intentionally cleared back to unknown', () => {
    expect(sql).toContain('p_surge_intensity_bps is not null');
    expect(sql).toContain("v_existing_event.payload -> 'surgeIntensityBps' is distinct from 'null'::jsonb");
  });
});
