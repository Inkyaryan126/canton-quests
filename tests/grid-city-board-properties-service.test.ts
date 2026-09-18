import { describe, expect, it, vi } from 'vitest';
import type { GridPropertyCommandPort } from '../lib/grid/server/property-port';
import {
  acquireGridWorldProperty,
  developGridWorldProperty,
} from '../lib/grid/server/property-action-service';

const targetPort = {
  resolveTarget: vi.fn().mockResolvedValue({
    seasonId: 'season-1',
    seasonStatus: 'active',
    propertyId: 'property-id-1',
  }),
};

describe('Grid City Board property actions', () => {
  it('resolves authority fields server-side before atomic acquisition', async () => {
    const acquireProperty = vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      playerId: 'player-1',
      propertyId: 'property-id-1',
      propertySlug: 'property-1',
      territoryId: 'territory-id-1',
      creditsSpent: 1500,
      commandPointsSpent: 2,
      credits: 2600,
      influence: 100,
      commandPoints: 6,
      eventId: 'event-1',
      acquiredAt: '2026-09-18T05:30:00.000Z',
    });
    const commandPort: GridPropertyCommandPort = {
      acquireProperty,
      developProperty: vi.fn(),
    };

    const result = await acquireGridWorldProperty(
      targetPort,
      commandPort,
      {
        playerId: 'player-1',
        propertySlug: 'property-1',
        idempotencyKey: 'acquire-1',
        now: '2026-09-18T05:30:00.000Z',
      },
    );

    expect(targetPort.resolveTarget).toHaveBeenCalledWith('property-1');
    expect(acquireProperty).toHaveBeenCalledWith({
      seasonId: 'season-1',
      playerId: 'player-1',
      propertyId: 'property-id-1',
      idempotencyKey: 'acquire-1',
      now: '2026-09-18T05:30:00.000Z',
    });
    expect(result).not.toHaveProperty('playerId');
    expect(result).not.toHaveProperty('seasonId');
    expect(result).not.toHaveProperty('propertyId');
    expect(result).not.toHaveProperty('eventId');
  });

  it('forwards only the selected development branch into the trusted command', async () => {
    const developProperty = vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      playerId: 'player-1',
      propertyId: 'property-id-1',
      propertySlug: 'property-1',
      territoryId: 'territory-id-1',
      creditsSpent: 900,
      commandPointsSpent: 1,
      credits: 1700,
      influence: 100,
      commandPoints: 5,
      eventId: 'event-2',
      developmentBranch: 'commerce',
      previousLevel: 0,
      developmentLevel: 1,
      developedAt: '2026-09-18T05:35:00.000Z',
      skylineEventId: null,
      skylineRuleIds: [],
    });
    const commandPort: GridPropertyCommandPort = {
      acquireProperty: vi.fn(),
      developProperty,
    };

    const result = await developGridWorldProperty(
      targetPort,
      commandPort,
      {
        playerId: 'player-1',
        propertySlug: 'property-1',
        branch: 'commerce',
        idempotencyKey: 'develop-1',
        now: '2026-09-18T05:35:00.000Z',
      },
    );

    expect(developProperty).toHaveBeenCalledWith({
      seasonId: 'season-1',
      playerId: 'player-1',
      propertyId: 'property-id-1',
      branch: 'commerce',
      idempotencyKey: 'develop-1',
      now: '2026-09-18T05:35:00.000Z',
    });
    expect(result).toMatchObject({
      propertySlug: 'property-1',
      developmentBranch: 'commerce',
      developmentLevel: 1,
      skylineFormed: false,
    });
    expect(result).not.toHaveProperty('eventId');
  });
});
