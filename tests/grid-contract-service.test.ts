import { describe, expect, it, vi } from 'vitest';
import { createGridContractInstance } from '../lib/grid/core/contracts';
import type { GridContractDefinition } from '../lib/grid/core/contract-types';
import { progressGridContract } from '../lib/grid/server/contract-service';
import type {
  GridContractCatalogPort,
  GridContractProgressPort,
  GridContractProgressCommand,
} from '../lib/grid/server/contract-port';

const definition: GridContractDefinition = {
  id: 'contract-alpha',
  kind: 'npc',
  objectives: [{ id: 'break-stronghold', target: 1 }],
  reward: { credits: 300, influence: 15, commandPoints: 1 },
  locationEnhancement: {
    bonusReward: { credits: 50, influence: 0, commandPoints: 0 },
  },
};

const command: GridContractProgressCommand = {
  cityId: 'canton-oh',
  seasonId: 'founding-season',
  playerId: 'player-1',
  contractId: 'contract-alpha',
  objectiveId: 'break-stronghold',
  amount: 1,
  idempotencyKey: 'event-stronghold-1',
  nowMs: 2_000,
  locationEnhanced: true,
};
function initialInstance(targetDefinition = definition) {
  return createGridContractInstance(targetDefinition, {
    playerId: 'player-1',
    acceptedAtMs: 1_000,
    expiresAtMs: null,
  });
}

describe('GRID contract progress service', () => {
  it('resolves definition server-side and commits state plus reward intents atomically', async () => {
    const getDefinition = vi.fn(async () => definition);
    const load = vi.fn(async () => ({ instance: initialInstance(), version: 7 }));
    const commit = vi.fn(async (input) => ({
      outcome: 'applied' as const,
      stored: { instance: input.nextInstance, version: 8 },
    }));
    const catalog: GridContractCatalogPort = { getDefinition };
    const port: GridContractProgressPort = { load, commit };

    const result = await progressGridContract(catalog, port, command);

    expect(getDefinition).toHaveBeenCalledWith({
      cityId: 'canton-oh', seasonId: 'founding-season', contractId: 'contract-alpha',
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]?.[0]).toMatchObject({
      idempotencyKey: 'event-stronghold-1',
      expectedVersion: 7,      rewardIntent: definition.reward,
      locationBonusIntent: definition.locationEnhancement?.bonusReward,
      nextInstance: expect.objectContaining({ status: 'completed', completedAtMs: 2_000 }),
    });
    expect(result).toMatchObject({
      outcome: 'applied',
      completedNow: true,
      rewardQueued: true,
      locationBonusQueued: true,
      version: 8,
      instance: { status: 'completed' },
    });
  });

  it('treats an idempotent replay as duplicate without claiming rewards were queued again', async () => {
    const catalog: GridContractCatalogPort = { getDefinition: async () => definition };
    const port: GridContractProgressPort = {
      load: async () => ({ instance: initialInstance(), version: 3 }),
      commit: async (input) => ({
        outcome: 'duplicate',
        stored: { instance: input.nextInstance, version: 4 },
      }),
    };

    const result = await progressGridContract(catalog, port, command);
    expect(result.outcome).toBe('duplicate');
    expect(result.completedNow).toBe(false);
    expect(result.rewardQueued).toBe(false);
    expect(result.locationBonusQueued).toBe(false);
  });
  it('reloads and reapplies progress after an optimistic concurrency conflict', async () => {
    const twoStep: GridContractDefinition = {
      ...definition,
      objectives: [{ id: 'break-stronghold', target: 2 }],
    };
    const start = initialInstance(twoStep);
    const concurrent = {
      ...start,
      progress: { 'break-stronghold': 1 },
    };
    const load = vi
      .fn()
      .mockResolvedValueOnce({ instance: start, version: 1 })
      .mockResolvedValueOnce({ instance: concurrent, version: 2 });
    const commit = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'conflict', stored: { instance: concurrent, version: 2 } })
      .mockImplementationOnce(async (input) => ({
        outcome: 'applied' as const,
        stored: { instance: input.nextInstance, version: 3 },
      }));

    const result = await progressGridContract(
      { getDefinition: async () => twoStep },
      { load, commit },
      { ...command, locationEnhanced: false },
    );

    expect(load).toHaveBeenCalledTimes(2);    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls.map((call) => call[0].expectedVersion)).toEqual([1, 2]);
    expect(result).toMatchObject({
      outcome: 'applied',
      completedNow: true,
      rewardQueued: true,
      version: 3,
      instance: { status: 'completed', progress: { 'break-stronghold': 2 } },
    });
  });

  it('rejects missing server definitions, missing state, and malformed commands', async () => {
    const port: GridContractProgressPort = {
      load: async () => null,
      commit: async () => { throw new Error('should not commit'); },
    };
    await expect(progressGridContract(
      { getDefinition: async () => null }, port, command,
    )).rejects.toThrow(/definition not found/i);

    await expect(progressGridContract(
      { getDefinition: async () => definition }, port, command,
    )).rejects.toThrow(/instance not found/i);

    await expect(progressGridContract(
      { getDefinition: async () => definition }, port,
      { ...command, idempotencyKey: '   ' },
    )).rejects.toThrow(/idempotency/i);
  });

  it('rejects malformed event values before consulting the catalog', async () => {
    const getDefinition = vi.fn(async () => definition);
    const load = vi.fn(async () => ({ instance: initialInstance(), version: 1 }));
    const catalog: GridContractCatalogPort = { getDefinition };
    const port: GridContractProgressPort = {
      load,
      commit: vi.fn(),
    };

    await expect(progressGridContract(catalog, port, {
      ...command,
      amount: Number.POSITIVE_INFINITY,
    })).rejects.toThrow(/amount.*safe integer/i);
    await expect(progressGridContract(catalog, port, {
      ...command,
      nowMs: Number.NaN,
    })).rejects.toThrow(/nowMs.*safe integer/i);
    await expect(progressGridContract(catalog, port, {
      ...command,
      locationEnhanced: 'yes' as never,
    })).rejects.toThrow(/locationEnhanced.*boolean/i);

    expect(getDefinition).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it('rejects a stored instance that crosses the player or contract boundary', async () => {
    const catalog: GridContractCatalogPort = { getDefinition: async () => definition };
    const port: GridContractProgressPort = {
      load: async () => ({
        instance: { ...initialInstance(), playerId: 'another-player' },
        version: 1,
      }),
      commit: vi.fn(),
    };

    await expect(progressGridContract(catalog, port, command)).rejects.toThrow(/player mismatch/i);

    const mismatchedContractPort: GridContractProgressPort = {
      load: async () => ({
        instance: { ...initialInstance(), contractId: 'another-contract' },
        version: 1,
      }),
      commit: vi.fn(),
    };
    await expect(progressGridContract(catalog, mismatchedContractPort, command))
      .rejects.toThrow(/contract mismatch/i);
  });

  it('rejects an invalid stored result from the atomic commit boundary', async () => {
    const port: GridContractProgressPort = {
      load: async () => ({ instance: initialInstance(), version: 1 }),
      commit: async (input) => ({
        outcome: 'applied',
        stored: {
          instance: { ...input.nextInstance, playerId: 'another-player' },
          version: -1,
        },
      }),
    };

    await expect(progressGridContract(
      { getDefinition: async () => definition }, port, command,
    )).rejects.toThrow(/invalid version/i);

    const mismatchedStoredPort: GridContractProgressPort = {
      load: async () => ({ instance: initialInstance(), version: 1 }),
      commit: async (input) => ({
        outcome: 'duplicate',
        stored: {
          instance: { ...input.nextInstance, playerId: 'another-player' },
          version: 2,
        },
      }),
    };
    await expect(progressGridContract(
      { getDefinition: async () => definition }, mismatchedStoredPort, command,
    )).rejects.toThrow(/player mismatch/i);
  });

  it('persists expiration for a stale event without advancing progress or queueing rewards', async () => {
    const expired = createGridContractInstance(definition, {
      playerId: 'player-1', acceptedAtMs: 1_000, expiresAtMs: 1_500,
    });
    const commit = vi.fn(async (input) => ({
      outcome: 'applied' as const,
      stored: { instance: input.nextInstance, version: 2 },
    }));

    const result = await progressGridContract(
      { getDefinition: async () => definition },
      {
        load: async () => ({ instance: expired, version: 1 }),
        commit,
      },
      command,
    );

    expect(commit).toHaveBeenCalledWith(expect.objectContaining({
      rewardIntent: null,
      locationBonusIntent: null,
      nextInstance: expect.objectContaining({ status: 'expired' }),
    }));
    expect(result).toMatchObject({
      outcome: 'applied', completedNow: false,
      rewardQueued: false, locationBonusQueued: false,
      instance: { status: 'expired', progress: { 'break-stronghold': 0 } },
    });
  });

  it('does not emit a second reward intent after duplicate completion', async () => {
    const completed = {
      ...initialInstance(),
      status: 'completed' as const,
      completedAtMs: 1_500,
      progress: { 'break-stronghold': 1 },
    };
    const commit = vi.fn(async (input) => ({
      outcome: 'applied' as const,
      stored: { instance: input.nextInstance, version: 9 },
    }));

    const result = await progressGridContract(
      { getDefinition: async () => definition },
      { load: async () => ({ instance: completed, version: 8 }), commit },
      command,
    );

    expect(commit).toHaveBeenCalledWith(expect.objectContaining({
      rewardIntent: null,
      locationBonusIntent: null,
      nextInstance: expect.objectContaining({ status: 'completed' }),
    }));
    expect(result).toMatchObject({
      outcome: 'applied',
      completedNow: false,
      rewardQueued: false,
      locationBonusQueued: false,
    });
  });
});
