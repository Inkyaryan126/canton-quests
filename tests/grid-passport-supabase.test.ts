import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-passport.ts'),
  'utf8',
);

describe('Grid Passport Supabase persistence contract', () => {
  it('reads only Passport-specific immutable events for the authenticated player identity', () => {
    expect(source).toContain(".from('grid_game_events')");
    expect(source).toContain(".eq('actor_player_id', playerId)");
    expect(source).toContain(".in('event_type', [...GRID_PASSPORT_EVENT_TYPES])");
    expect(source).toContain(".order('created_at', { ascending: true })");
  });

  it('caches only permanent global Passport fields', () => {
    expect(source).toContain(".from('grid_player_profiles')");
    expect(source).toContain('passport: projection');
    expect(source).toContain(
      'global_reputation: projection.nationalReputation',
    );
    expect(source).not.toContain('grid_player_season_state');
    expect(source).not.toContain('credits:');
    expect(source).not.toContain('influence:');
    expect(source).not.toContain('command_points');
    expect(source).not.toContain('city_power');
  });

  it('maps database envelope authority over any conflicting payload fields', () => {
    const payloadIndex = source.indexOf('...(row.payload ?? {})');
    const idIndex = source.indexOf('id: row.id');
    const typeIndex = source.indexOf('type: coreTypeByEventType[row.event_type]');
    const timeIndex = source.indexOf('occurredAt: row.created_at');

    expect(payloadIndex).toBeGreaterThan(-1);
    expect(idIndex).toBeGreaterThan(payloadIndex);
    expect(typeIndex).toBeGreaterThan(payloadIndex);
    expect(timeIndex).toBeGreaterThan(payloadIndex);
  });
});
