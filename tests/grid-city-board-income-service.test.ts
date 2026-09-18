import { describe, expect, it, vi } from 'vitest';
import type { GridEconomyCommandPort } from '../lib/grid/server/economy-port';
import { collectGridWorldIncome } from '../lib/grid/server/income-action-service';

describe('Grid City Board income collection', () => {
  it('resolves the active season server-side before atomic settlement', async () => {
    const seasonPort = {
      getCurrentSeason: vi.fn().mockResolvedValue({
        seasonId: 'season-1',
        seasonStatus: 'active',
      }),
    };
    const settleResources = vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      playerId: 'player-1',
      credits: 4205,
      influence: 102,
      commandPoints: 7,
      commandPointsUpdatedAt: '2026-09-18T06:00:00.000Z',
      resourcesSettledAt: '2026-09-18T06:00:00.000Z',
      creditsAccrualRemainder: 120000,
      influenceAccrualRemainder: 240000,
      joined: false,
      eventId: 'event-1',
    });
    const economyPort: GridEconomyCommandPort = {
      joinSeason: vi.fn(),
      settleResources,
    };

    const result = await collectGridWorldIncome(
      seasonPort,
      economyPort,
      {
        playerId: 'player-1',
        idempotencyKey: 'income-1',
        now: '2026-09-18T06:00:00.000Z',
      },
    );

    expect(settleResources).toHaveBeenCalledWith({
      seasonId: 'season-1',
      playerId: 'player-1',
      idempotencyKey: 'income-1',
      now: '2026-09-18T06:00:00.000Z',
    });
    expect(result).toEqual({
      credits: 4205,
      influence: 102,
      commandPoints: 7,
      resourcesSettledAt: '2026-09-18T06:00:00.000Z',
    });
    expect(result).not.toHaveProperty('playerId');
    expect(result).not.toHaveProperty('seasonId');
    expect(result).not.toHaveProperty('eventId');
  });

  it('rejects an inactive season before settlement', async () => {
    const seasonPort = {
      getCurrentSeason: vi.fn().mockResolvedValue({
        seasonId: 'season-1',
        seasonStatus: 'draft',
      }),
    };
    const economyPort: GridEconomyCommandPort = {
      joinSeason: vi.fn(),
      settleResources: vi.fn(),
    };

    await expect(
      collectGridWorldIncome(seasonPort, economyPort, {
        playerId: 'player-1',
        idempotencyKey: 'income-2',
        now: '2026-09-18T06:00:00.000Z',
      }),
    ).rejects.toThrow('requires an active season');

    expect(economyPort.settleResources).not.toHaveBeenCalled();
  });
});
