import { describe, expect, it, vi } from 'vitest';
import { cantonFoundingSeasonPackage as pkg } from '../lib/grid/cities/canton/founding-season';
import {
  collectGridOnboardingIncome,
  projectGridOnboardingIncome,
} from '../lib/grid/server/onboarding-income-service';
import type { GridEconomyCommandPort } from '../lib/grid/server/economy-port';

const playerId = 'player-1';
const settledAt = '2026-09-18T04:00:00.000Z';
const territorySlug =
  pkg.seasonTemplate.economy!.neutralClaims.starterTerritorySlugs[0];
const property = pkg.properties.find(
  (candidate) => candidate.territorySlug === territorySlug,
)!;

function readPort() {
  return {
    getContext: vi.fn().mockResolvedValue({
      cityId: 'city-1',
      seasonId: 'season-1',
      lastActiveAt: settledAt,
      resources: {
        credits: 1700,
        influence: 100,
        commandPoints: 5,
        commandPointsUpdatedAt: settledAt,
        resourcesSettledAt: settledAt,
        creditsAccrualRemainder: 0,
        influenceAccrualRemainder: 0,
        ownedTerritorySlugs: [territorySlug],
        ownedProperties: [{
          propertySlug: property.slug,
          developmentBranch: 'commerce' as const,
          developmentLevel: 1,
        }],
      },
    }),
  };
}
describe('Grid onboarding first-income projection', () => {
  it('previews production without making a settlement write', async () => {
    const port = readPort();
    const projection = await projectGridOnboardingIncome(
      port,
      pkg,
      playerId,
      '2026-09-18T04:01:00.000Z',
    );

    expect(projection).toMatchObject({
      state: 'accumulating',
      pendingCredits: 0,
      pendingInfluence: 0,
      creditsPerHour: 9,
      influencePerHour: 2,
      collectibleAt: '2026-09-18T04:06:40.000Z',
    });
    expect(port.getContext).toHaveBeenCalledWith(playerId);
  });

  it('becomes collectible only after a whole resource has accrued', async () => {
    const projection = await projectGridOnboardingIncome(
      readPort(),
      pkg,
      playerId,
      '2026-09-18T04:07:00.000Z',
    );

    expect(projection.state).toBe('collectible');
    expect(projection.pendingCredits).toBe(1);
    expect(projection.pendingInfluence).toBe(0);
    expect(projection.collectibleAt).toBeNull();
  });
});
describe('Grid onboarding first-income collection', () => {
  const seasonPort = {
    getCurrentSeason: vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      status: 'active',
    }),
  };

  it('refuses to write a zero-income settlement event', async () => {
    const economyPort: GridEconomyCommandPort = {
      joinSeason: vi.fn(),
      settleResources: vi.fn(),
    };

    await expect(
      collectGridOnboardingIncome(
        readPort(),
        seasonPort,
        economyPort,
        pkg,
        {
          playerId,
          idempotencyKey: 'first-income-1',
          now: '2026-09-18T04:01:00.000Z',
        },
      ),
    ).rejects.toThrow('still accumulating until 2026-09-18T04:06:40.000Z');
    expect(economyPort.settleResources).not.toHaveBeenCalled();
  });
  it('settles through the atomic economy command once income is collectible', async () => {
    const settleResources = vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      playerId,
      credits: 1701,
      influence: 100,
      commandPoints: 5,
      commandPointsUpdatedAt: settledAt,
      resourcesSettledAt: '2026-09-18T04:07:00.000Z',
      creditsAccrualRemainder: 180000,
      influenceAccrualRemainder: 840000,
      joined: false,
      eventId: 'event-1',
    });
    const economyPort: GridEconomyCommandPort = {
      joinSeason: vi.fn(),
      settleResources,
    };

    const result = await collectGridOnboardingIncome(
      readPort(),
      seasonPort,
      economyPort,
      pkg,
      {
        playerId,
        idempotencyKey: 'first-income-2',
        now: '2026-09-18T04:07:00.000Z',
      },
    );

    expect(settleResources).toHaveBeenCalledWith({
      seasonId: 'season-1',
      playerId,
      idempotencyKey: 'first-income-2',
      now: '2026-09-18T04:07:00.000Z',
    });
    expect(result).toMatchObject({
      creditsCollected: 1,
      influenceCollected: 0,
      credits: 1701,
      influence: 100,
    });
    expect(result).not.toHaveProperty('eventId');
    expect(result).not.toHaveProperty('playerId');
  });
});
