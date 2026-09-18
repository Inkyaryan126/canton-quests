import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseGridAlliancePersistencePort } from '../lib/grid/server/supabase-alliance-persistence';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-alliance-persistence.ts'),
  'utf8',
);

describe('Supabase GRID Alliance persistence adapter', () => {
  it('requires trusted service-role configuration', () => {
    expect(() => createSupabaseGridAlliancePersistencePort(null as any)).toThrow(
      'Grid Alliance persistence requires Supabase service-role configuration',
    );
  });

  it('routes membership mutations through atomic RPCs', async () => {
    const membership = {
      playerId: 'player-2', seasonId: 'season-1', allianceId: 'alliance-1',
      joinedAt: '2026-09-18T03:00:00.000Z', leftAt: null, cooldownUntil: null,
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: membership, error: null })
      .mockResolvedValueOnce({ data: { ...membership, leftAt: '2026-09-18T04:00:00.000Z', cooldownUntil: '2026-09-18T05:00:00.000Z' }, error: null });
    const adapter = createSupabaseGridAlliancePersistencePort({ rpc } as any);

    await adapter.joinAlliance({
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'player-2',
      joinedAt: membership.joinedAt, maxMembers: 4,
    });
    await adapter.leaveAlliance({
      allianceId: 'alliance-1', seasonId: 'season-1', playerId: 'player-2',
      leftAt: '2026-09-18T04:00:00.000Z', cooldownUntil: '2026-09-18T05:00:00.000Z',
    });

    expect(rpc).toHaveBeenNthCalledWith(1, 'grid_join_alliance', expect.objectContaining({
      p_alliance_id: 'alliance-1', p_max_members: 4,
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, 'grid_leave_alliance', expect.objectContaining({
      p_player_id: 'player-2', p_cooldown_until: '2026-09-18T05:00:00.000Z',
    }));
  });

  it('derives upkeep network inputs from seasonal ownership and city adjacency', () => {
    expect(source).toContain(".from('grid_season_territory_state')");
    expect(source).toContain(".from('grid_territories')");
    expect(source).toContain(".from('grid_territory_edges')");
    expect(source).toContain('getActiveMemberPlayerIds');
    expect(source).toContain('getAllianceNetworkInputs');
  });

  it('routes upkeep settlement through the trusted atomic RPC', () => {
    expect(source).toContain("'grid_settle_alliance_upkeep'");
    expect(source).toContain('p_expected_alliance_revision');
    expect(source).toContain('p_disconnected_component_count');
    expect(source).toContain('p_shortfall_influence');
  });

  it('reads Alliance state and membership history only from dedicated tables', () => {
    expect(source).toContain(".from('grid_alliances')");
    expect(source).toContain(".from('grid_alliance_memberships')");
    expect(source).toContain(".is('left_at', null)");
    expect(source).not.toMatch(/grid_player_season_state.*update|credits_pool|command_points_pool/s);
  });
});
