import { describe, expect, it, vi } from 'vitest';
import { listActiveGridContracts, readGridContract } from '../lib/grid/server/contract-read-service';
import type { GridContractReadPort } from '../lib/grid/server/contract-read-port';

const definition = (id: string) => ({
  id,
  kind: 'npc' as const,
  objectives: [{ id: 'objective-1', target: 2 }],
  reward: { credits: 100, influence: 5, commandPoints: 1 },
});

const record = (id: string, playerId = 'player-1') => ({
  definition: definition(id),
  instance: {
    contractId: id,
    playerId,
    status: 'active' as const,
    acceptedAtMs: 1_000,
    expiresAtMs: null,
    completedAtMs: null,
    locationEnhanced: false,
    progress: { 'objective-1': 1 },
  },
  version: 3,
});

function portWith(overrides: Partial<GridContractReadPort> = {}): GridContractReadPort {
  return {
    listActive: vi.fn(async () => [record('contract-z'), record('contract-a')]),
    read: vi.fn(async () => record('contract-a')),
    ...overrides,
  };
}

describe('Grid private Contract read service', () => {
  it('returns only active records in deterministic contract order', async () => {
    const port = portWith();
    await expect(listActiveGridContracts(port, {
      cityId: 'city-1', seasonId: 'season-1', playerId: 'player-1',
    })).resolves.toMatchObject({
      cityId: 'city-1',
      seasonId: 'season-1',
      contracts: [
        { contract: { id: 'contract-a' } },
        { contract: { id: 'contract-z' } },
      ],
    });
    expect(port.listActive).toHaveBeenCalledWith({
      cityId: 'city-1', seasonId: 'season-1', playerId: 'player-1',
    });
  });

  it('returns a scoped detail record and preserves progress state', async () => {
    const result = await readGridContract(portWith(), {
      cityId: 'city-1', seasonId: 'season-1', playerId: 'player-1', contractId: 'contract-a',
    });
    expect(result).toMatchObject({
      cityId: 'city-1', seasonId: 'season-1',
      contract: { state: { playerId: 'player-1', progress: { 'objective-1': 1 } } },
    });
  });

  it('does not fabricate a detail record when persistence has no matching state', async () => {
    await expect(readGridContract(portWith({ read: vi.fn(async () => null) }), {
      cityId: 'city-1', seasonId: 'season-1', playerId: 'player-1', contractId: 'missing',
    })).resolves.toBeNull();
  });

  it('rejects blank scope before persistence access and rejects cross-player state', async () => {
    const port = portWith();
    await expect(listActiveGridContracts(port, {
      cityId: ' ', seasonId: 'season-1', playerId: 'player-1',
    })).rejects.toThrow(/cityId/);
    expect(port.listActive).not.toHaveBeenCalled();

    await expect(readGridContract(portWith({ read: vi.fn(async () => record('contract-a', 'other-player')) }), {
      cityId: 'city-1', seasonId: 'season-1', playerId: 'player-1', contractId: 'contract-a',
    })).rejects.toThrow(/player mismatch/);
  });
});
