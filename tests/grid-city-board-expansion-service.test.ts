import { describe, expect, it, vi } from 'vitest';
import type { GridTerritoryClaimPort } from '../lib/grid/server/territory-claim-port';
import { claimGridWorldTerritory } from '../lib/grid/server/territory-action-service';

describe('Grid City Board expansion service', () => {
  it('resolves authority fields on the server before calling the atomic claim command', async () => {
    const targetPort = {
      resolveTarget: vi.fn().mockResolvedValue({
        seasonId: 'season-1',
        seasonStatus: 'active',
        territoryId: 'territory-id-1',
      }),
    };
    const claimNeutralTerritory = vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      playerId: 'player-1',
      territoryId: 'territory-id-1',
      territorySlug: 'census-block-1',
      claimedAt: '2026-09-18T05:00:00.000Z',
      claimMode: 'adjacent',
      creditsSpent: 900,
      commandPointsSpent: 1,
      credits: 2500,
      influence: 100,
      commandPoints: 4,
      eventId: 'event-1',
    });
    const claimPort: GridTerritoryClaimPort = { claimNeutralTerritory };

    const result = await claimGridWorldTerritory(
      targetPort,
      claimPort,
      {
        playerId: 'player-1',
        territorySlug: 'census-block-1',
        idempotencyKey: 'claim-1',
        now: '2026-09-18T05:00:00.000Z',
      },
    );

    expect(targetPort.resolveTarget).toHaveBeenCalledWith('census-block-1');
    expect(claimNeutralTerritory).toHaveBeenCalledWith({
      seasonId: 'season-1',
      playerId: 'player-1',
      territoryId: 'territory-id-1',
      idempotencyKey: 'claim-1',
      now: '2026-09-18T05:00:00.000Z',
    });
    expect(result).toMatchObject({
      territorySlug: 'census-block-1',
      claimMode: 'adjacent',
      creditsSpent: 900,
      commandPointsSpent: 1,
      credits: 2500,
      commandPoints: 4,
    });
    expect(result).not.toHaveProperty('playerId');
    expect(result).not.toHaveProperty('seasonId');
    expect(result).not.toHaveProperty('territoryId');
    expect(result).not.toHaveProperty('eventId');
  });

  it('rejects targets outside an active season before mutation', async () => {
    const targetPort = {
      resolveTarget: vi.fn().mockResolvedValue({
        seasonId: 'season-1',
        seasonStatus: 'draft',
        territoryId: 'territory-id-1',
      }),
    };
    const claimPort: GridTerritoryClaimPort = {
      claimNeutralTerritory: vi.fn(),
    };

    await expect(
      claimGridWorldTerritory(targetPort, claimPort, {
        playerId: 'player-1',
        territorySlug: 'census-block-1',
        idempotencyKey: 'claim-2',
        now: '2026-09-18T05:00:00.000Z',
      }),
    ).rejects.toThrow('requires an active season and valid target');
    expect(claimPort.claimNeutralTerritory).not.toHaveBeenCalled();
  });
});
