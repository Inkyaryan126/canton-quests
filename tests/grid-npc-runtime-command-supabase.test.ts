import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-npc-stronghold-runtime-command.ts'),
  'utf8',
);
describe('Supabase Grid NPC runtime command adapter', () => {
  it('uses only the dedicated command RPCs', () => {
    expect(source).toContain("client.rpc('grid_set_npc_surge_intensity'");
    expect(source).toContain("client.rpc('grid_set_npc_faction_pressure'");
    expect(source).toContain("client.rpc('grid_set_npc_stronghold_event_state'");
  });
  it('passes actor, idempotency key, and command time through every write', () => {
    expect(source.match(/p_actor_player_id: command\.actorPlayerId/g)?.length).toBe(3);
    expect(source.match(/p_idempotency_key: command\.idempotencyKey/g)?.length).toBe(3);
    expect(source.match(/p_now: command\.now/g)?.length).toBe(3);
  });
});
