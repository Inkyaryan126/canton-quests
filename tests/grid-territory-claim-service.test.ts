import { describe, expect, it, vi } from 'vitest';
import type {
  GridTerritoryClaimPort,
  GridTerritoryClaimResult,
} from '../lib/grid/server/territory-claim-port';
import { claimNeutralGridTerritory } from '../lib/grid/server/territory-claim-service';
import { createSupabaseGridTerritoryClaimPort } from '../lib/grid/server/supabase-territory-claim';

const result: GridTerritoryClaimResult = {
  seasonId: '00000000-0000-4000-8000-000000000001',
  cityId: '00000000-0000-4000-8000-000000000002',
  playerId: '00000000-0000-4000-8000-000000000003',
  territoryId: '00000000-0000-4000-8000-000000000004',
  territorySlug: 'starter-a',
  claimedAt: '2026-09-14T17:00:00.000Z',
  claimMode: 'starter',
  creditsSpent: 25,
  commandPointsSpent: 1,
  credits: 4975,
  influence: 100,
  commandPoints: 9,
  eventId: '00000000-0000-4000-8000-000000000005',
};

const command = {
  seasonId: result.seasonId,
  playerId: result.playerId,
  territoryId: result.territoryId,
  idempotencyKey: 'claim:starter-a:player-3',
  now: result.claimedAt,
};

describe('claimNeutralGridTerritory', () => {
  it('validates and forwards the claim command', async () => {
    const port: GridTerritoryClaimPort = {
      claimNeutralTerritory: vi.fn().mockResolvedValue(result),
    };
    await expect(claimNeutralGridTerritory(port, command)).resolves.toEqual(result);
    expect(port.claimNeutralTerritory).toHaveBeenCalledWith(command);
  });

  it('rejects blank idempotency keys and invalid command times', async () => {
    const port: GridTerritoryClaimPort = {
      claimNeutralTerritory: vi.fn(),
    };
    await expect(
      claimNeutralGridTerritory(port, { ...command, idempotencyKey: ' ' }),
    ).rejects.toThrow('Grid territory claim requires a non-empty idempotency key');
    await expect(
      claimNeutralGridTerritory(port, { ...command, now: 'bad-time' }),
    ).rejects.toThrow('Grid territory claim requires a valid now timestamp');
    expect(port.claimNeutralTerritory).not.toHaveBeenCalled();
  });
});

describe('Supabase Grid territory claim adapter', () => {
  it('requires service-role Supabase configuration', () => {
    expect(() => createSupabaseGridTerritoryClaimPort(null as any)).toThrow(
      'Grid territory claims require Supabase service-role configuration',
    );
  });

  it('calls the atomic neutral-claim RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    const port = createSupabaseGridTerritoryClaimPort({ rpc } as any);
    await expect(port.claimNeutralTerritory(command)).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith('grid_claim_neutral_territory', {
      p_season_id: command.seasonId,
      p_player_id: command.playerId,
      p_territory_id: command.territoryId,
      p_idempotency_key: command.idempotencyKey,
      p_now: command.now,
    });
  });

  it('surfaces RPC errors without mutating through another path', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'TERRITORY_NOT_ADJACENT' },
    });
    const port = createSupabaseGridTerritoryClaimPort({ rpc } as any);
    await expect(port.claimNeutralTerritory(command)).rejects.toThrow(
      'Failed to claim Grid territory: TERRITORY_NOT_ADJACENT',
    );
  });
});
