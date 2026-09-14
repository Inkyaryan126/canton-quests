import { describe, expect, it, vi } from 'vitest';
import type {
  GridEconomyCommandPort,
  GridPlayerSeasonState,
} from '../lib/grid/server/economy-port';
import {
  joinGridSeason,
  settleGridPlayerResources,
} from '../lib/grid/server/economy-service';
import { createSupabaseGridEconomyCommandPort } from '../lib/grid/server/supabase-economy';

const state: GridPlayerSeasonState = {
  seasonId: '00000000-0000-4000-8000-000000000001',
  cityId: '00000000-0000-4000-8000-000000000002',
  playerId: '00000000-0000-4000-8000-000000000003',
  credits: 5000,
  influence: 100,
  commandPoints: 10,
  commandPointsUpdatedAt: '2026-09-14T16:00:00.000Z',
  resourcesSettledAt: '2026-09-14T16:00:00.000Z',
  creditsAccrualRemainder: 0,
  influenceAccrualRemainder: 0,
  joined: true,
  eventId: '00000000-0000-4000-8000-000000000004',
};

function port(): GridEconomyCommandPort {
  return {
    joinSeason: vi.fn().mockResolvedValue(state),
    settleResources: vi.fn().mockResolvedValue({ ...state, joined: false }),
  };
}

describe('Grid economy command service', () => {
  it('forwards a validated season join command', async () => {
    const p = port();
    const command = {
      seasonId: state.seasonId,
      playerId: state.playerId,
      idempotencyKey: 'join:test-player',
      now: '2026-09-14T16:00:00.000Z',
    };

    await expect(joinGridSeason(p, command)).resolves.toEqual(state);
    expect(p.joinSeason).toHaveBeenCalledWith(command);
  });

  it('forwards a validated resource settlement command', async () => {
    const p = port();
    const command = {
      seasonId: state.seasonId,
      playerId: state.playerId,
      idempotencyKey: 'settle:test-player:1',
      now: '2026-09-14T17:00:00.000Z',
    };

    await settleGridPlayerResources(p, command);
    expect(p.settleResources).toHaveBeenCalledWith(command);
  });

  it('rejects blank idempotency keys and invalid timestamps before touching persistence', async () => {
    const p = port();

    await expect(
      joinGridSeason(p, {
        seasonId: state.seasonId,
        playerId: state.playerId,
        idempotencyKey: '   ',
        now: '2026-09-14T16:00:00.000Z',
      }),
    ).rejects.toThrow('Grid economy command requires a non-empty idempotency key');

    await expect(
      settleGridPlayerResources(p, {
        seasonId: state.seasonId,
        playerId: state.playerId,
        idempotencyKey: 'settle:test',
        now: 'not-a-date',
      }),
    ).rejects.toThrow('Grid economy command requires a valid now timestamp');

    expect(p.joinSeason).not.toHaveBeenCalled();
    expect(p.settleResources).not.toHaveBeenCalled();
  });
});

describe('Supabase Grid economy command adapter', () => {
  it('requires service-role Supabase configuration', () => {
    expect(() => createSupabaseGridEconomyCommandPort(null as any)).toThrow(
      'Grid economy commands require Supabase service-role configuration',
    );
  });

  it('calls the atomic join RPC and maps its JSON result', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: state, error: null });
    const adapter = createSupabaseGridEconomyCommandPort({ rpc } as any);

    await expect(
      adapter.joinSeason({
        seasonId: state.seasonId,
        playerId: state.playerId,
        idempotencyKey: 'join:test-player',
        now: '2026-09-14T16:00:00.000Z',
      }),
    ).resolves.toEqual(state);

    expect(rpc).toHaveBeenCalledWith('grid_join_season', {
      p_season_id: state.seasonId,
      p_player_id: state.playerId,
      p_idempotency_key: 'join:test-player',
      p_now: '2026-09-14T16:00:00.000Z',
    });
  });

  it('calls the atomic settlement RPC and surfaces database errors', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { ...state, joined: false }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'SEASON_NOT_ACTIVE' } });
    const adapter = createSupabaseGridEconomyCommandPort({ rpc } as any);
    const command = {
      seasonId: state.seasonId,
      playerId: state.playerId,
      idempotencyKey: 'settle:test-player:1',
      now: '2026-09-14T17:00:00.000Z',
    };

    await expect(adapter.settleResources(command)).resolves.toEqual({
      ...state,
      joined: false,
    });
    await expect(adapter.settleResources(command)).rejects.toThrow(
      'Failed to settle Grid resources: SEASON_NOT_ACTIVE',
    );
  });
});
