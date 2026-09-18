import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918075000_grid_npc_stronghold_definition_commands.sql'),
  'utf8',
);
describe('Grid NPC stronghold definition admin schema', () => {
  it('creates separate audited upsert and enabled-state RPCs', () => {
    expect(sql).toContain('grid_upsert_npc_stronghold_definition');
    expect(sql).toContain('grid_set_npc_stronghold_definition_enabled');
    expect(sql).toContain("'grid:npc_stronghold_definition_upserted'");
    expect(sql).toContain("'grid:npc_stronghold_definition_enabled_set'");
  });
  it('inserts new definitions disabled rather than silently activating them', () => {
    expect(sql).toContain('false, p_now, p_now');
  });
  it('locks identity/tuning changes after any contest history exists', () => {
    expect(sql).toContain('NPC_STRONGHOLD_DEFINITION_LOCKED_AFTER_CONTEST');
    expect(sql).toContain('from public.grid_pve_stronghold_contests');
    expect(sql).toContain('and stronghold_id = p_stronghold_id');
  });
  it('blocks disabling a definition during an active contest', () => {
    expect(sql).toContain('NPC_STRONGHOLD_ACTIVE_CONTEST_LOCK');
    expect(sql).toContain("and status = 'active'");
  });
  it('serializes per-stronghold mutations and reconciles idempotency', () => {
    expect(sql.match(/pg_catalog\.pg_advisory_xact_lock/g)?.length).toBe(2);
    expect(sql.match(/IDEMPOTENCY_KEY_COLLISION/g)?.length).toBe(2);
  });
  it('restricts both mutation RPCs to service_role', () => {
    expect(sql.match(/from public, anon, authenticated;/g)?.length).toBe(2);
    expect(sql.match(/to service_role;/g)?.length).toBe(2);
  });
  it('never deletes definitions or rewrites immutable ledger events', () => {
    expect(sql).not.toMatch(/delete\s+from\s+public\.grid_npc_stronghold_definitions/i);
    expect(sql).not.toMatch(/update\s+public\.grid_game_events/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.grid_game_events/i);
  });
});
