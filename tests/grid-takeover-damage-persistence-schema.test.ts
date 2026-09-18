import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260916061500_grid_takeover_damage_persistence.sql',
  ),
  'utf8',
);

describe('Grid takeover damage persistence schema', () => {
  it('reacts only to authoritative contest capture events', () => {
    expect(sql).toContain("new.event_type = 'grid:contest_session_round_resolved'");
    expect(sql).toContain("new.event_type = 'grid:contest_auto_retreat_capture'");
    expect(sql).toContain("'territoryCaptured'");
    expect(sql).toContain('grid_game_events_apply_takeover_damage');
    expect(sql).not.toContain('after update on public.grid_season_territory_state');
  });

  it('loads optional per-season takeover tuning with safe backward-compatible defaults', () => {
    expect(sql).toContain("season.config -> 'contest' -> 'takeoverDamage'");
    expect(sql).toContain('v_retention_bps integer := 10000');
    expect(sql).toContain('v_condition_damage_bps integer := 0');
    expect(sql).toContain('v_condition_floor_bps integer := 0');
    expect(sql).toContain('TAKEOVER_DAMAGE_CONFIG_INVALID');
  });
  it('transfers only defender-owned properties in the captured territory', () => {
    expect(sql).toContain('public.grid_season_property_state');
    expect(sql).toContain('public.grid_properties');
    expect(sql).toContain('property.territory_id = v_target_territory_id');
    expect(sql).toContain('state.owner_player_id = v_defender_player_id');
    expect(sql).toContain('owner_player_id = new.actor_player_id');
    expect(sql).toContain('acquired_at = new.created_at');
  });

  it('applies deterministic development and condition damage without violating branch constraints', () => {
    expect(sql).toContain(
      'v_property.development_level::bigint * v_retention_bps',
    );
    expect(sql).toContain('v_property.condition_bps - v_condition_damage_bps');
    expect(sql).toContain('v_condition_floor_bps');
    expect(sql).toContain('when v_next_level = 0 then null');
  });

  it('records a causally linked append-only damage event', () => {
    expect(sql).toContain("'grid:takeover_property_damage_applied'");
    expect(sql).toContain("'propertiesTransferred'");
    expect(sql).toContain("'developmentLevelsLost'");
    expect(sql).toContain("'conditionLostBps'");
    expect(sql).toContain("'takeover-damage:' || new.id::text");
    expect(sql).toContain('causation_id');
    expect(sql).toContain('new.id');
  });
});
