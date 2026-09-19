import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-npc-stronghold-runtime.ts'),
  'utf8',
);

describe('Supabase NPC Dominance pressure fallback contract', () => {
  it('keeps explicit GM pressure rows as the first authority', () => {
    const explicit = source.indexOf(
      'factionPressureBpsByFaction[row.faction_id] = row.pressure_bps',
    );
    const missing = source.indexOf('const missingFactionIds');
    const fallback = source.indexOf('readCantonDominancePressureBps(');

    expect(explicit).toBeGreaterThan(0);
    expect(missing).toBeGreaterThan(explicit);
    expect(fallback).toBeGreaterThan(0);
    expect(source).toContain(
      'factionPressureBpsByFaction[factionId] === undefined',
    );
  });

  it('derives fallback only for active Canton seasons with missing requested factions', () => {
    expect(source).toContain('seasonActive &&');
    expect(source).toContain("city.slug === 'canton-oh'");
    expect(source).toContain('missingFactionIds.length > 0');
    expect(source).toContain(
      'factionPressureBpsByFaction[factionId] = dominancePressureBps',
    );
  });

  it('derives pressure from authoritative territory ownership and active alliances', () => {
    expect(source).toContain(".from('grid_territories')");
    expect(source).toContain(".from('grid_season_territory_state')");
    expect(source).toContain(".not('owner_player_id', 'is', null)");
    expect(source).toContain(".from('grid_alliances')");
    expect(source).toContain(".eq('status', 'active')");
    expect(source).toContain(".from('grid_alliance_memberships')");
    expect(source).toContain(".is('left_at', null)");
    expect(source).toContain('deriveGridNpcDominancePressure(');
    expect(source).toContain('cantonDominanceHeatConfig');
  });

  it('does not write derived pressure into GM runtime state', () => {
    expect(source).not.toMatch(
      /\.from\('grid_npc_faction_pressure_state'\).*\.(insert|update|upsert|delete)\(/s,
    );
    expect(source).not.toContain("rpc('grid_set_npc_faction_pressure'");
  });
});
