import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260918052000_grid_global_event_idempotency.sql'), 'utf8');
describe('Grid seasonless event idempotency', () => {
  it('fails closed on historical duplicates and uniquely indexes global keys', () => {
    expect(sql).toContain('GRID_GLOBAL_EVENT_IDEMPOTENCY_DUPLICATES_EXIST');
    expect(sql).toContain('create unique index if not exists grid_game_events_global_idempotency_uq');
    expect(sql).toContain('on public.grid_game_events (idempotency_key)');
    expect(sql).toContain('where season_id is null and idempotency_key is not null');
    expect(sql).not.toMatch(/delete\s+from\s+public\.grid_game_events/i);
  });
});
