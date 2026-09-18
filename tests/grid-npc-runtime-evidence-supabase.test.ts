import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isGridNpcSeasonActiveAt } from '../lib/grid/server/supabase-npc-stronghold-runtime';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-npc-stronghold-runtime.ts'),
  'utf8',
);

describe('Supabase Grid NPC runtime evidence adapter', () => {
  it('derives season activity from status and the requested time window', () => {
    const season = {
      status: 'active',
      starts_at: '2026-09-18T10:00:00.000Z',
      ends_at: '2026-09-20T10:00:00.000Z',
    };
    expect(isGridNpcSeasonActiveAt(season, '2026-09-18T09:59:59.000Z')).toBe(false);
    expect(isGridNpcSeasonActiveAt(season, '2026-09-18T10:00:00.000Z')).toBe(true);
    expect(isGridNpcSeasonActiveAt({ ...season, status: 'surge' }, '2026-09-19T10:00:00.000Z')).toBe(true);
    expect(isGridNpcSeasonActiveAt(season, '2026-09-20T10:00:00.000Z')).toBe(false);
    expect(isGridNpcSeasonActiveAt({ ...season, status: 'scheduled' }, '2026-09-19T10:00:00.000Z')).toBe(false);
  });

  it('rejects invalid timestamps rather than guessing activity', () => {
    expect(() => isGridNpcSeasonActiveAt(
      { status: 'active', starts_at: null, ends_at: null }, 'bad-time',
    )).toThrow('valid now timestamp');
    expect(() => isGridNpcSeasonActiveAt(
      { status: 'active', starts_at: 'bad-start', ends_at: null }, '2026-09-18T12:00:00Z',
    )).toThrow('stored startsAt timestamp is invalid');
  });

  it('reads optional evidence rows without replacing missing rows with defaults', () => {
    expect(source).toContain(".from('grid_npc_season_runtime_state')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain(".from('grid_npc_stronghold_event_state')");
    expect(source).toContain(".from('grid_npc_faction_pressure_state')");
    expect(source).toContain('surgeIntensityBps: seasonRuntime?.surge_intensity_bps ?? null');
    expect(source).not.toContain('surgeIntensityBps: seasonRuntime?.surge_intensity_bps ?? 0');
  });

  it('returns only requested event/faction identities and rejects cross-city rows', () => {
    expect(source).toContain(".in('stronghold_id', request.strongholdIds)");
    expect(source).toContain(".in('faction_id', request.factionIds)");
    expect(source).toContain('Grid NPC event runtime returned unexpected identity');
    expect(source).toContain('Grid NPC faction runtime returned unexpected identity');
  });
});
