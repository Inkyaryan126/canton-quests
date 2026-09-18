import { describe, expect, it, vi } from 'vitest';
import { cantonFoundingSeasonPackage as pkg } from '../lib/grid/cities/canton/founding-season';
import {
  acquireGridOnboardingProperty,
  developGridOnboardingProperty,
  projectGridOnboardingProperties,
} from '../lib/grid/server/onboarding-property-service';
import type { GridPropertyCommandPort } from '../lib/grid/server/property-port';

const playerId = 'player-1';
const starterSlug =
  pkg.seasonTemplate.economy!.neutralClaims.starterTerritorySlugs.find((slug) =>
    pkg.properties.some((property) => property.territorySlug === slug),
  )!;
const property = pkg.properties.find(
  (candidate) => candidate.territorySlug === starterSlug,
)!;

function runtime(
  propertyState?: {
    ownerPlayerId: string | null;
    developmentBranch: 'commerce' | null;
    developmentLevel: number;
  },
) {
  return {
    seasonId: 'season-1',
    seasonStatus: 'active',
    territories: [{
      territorySlug: starterSlug,
      ownerPlayerId: playerId,
      claimedAt: '2026-09-18T01:00:00Z',
    }],
    properties: propertyState
      ? [{
          propertySlug: property.slug,
          ownerPlayerId: propertyState.ownerPlayerId,
          acquiredAt: propertyState.ownerPlayerId
            ? '2026-09-18T01:05:00Z'
            : null,
          developmentBranch: propertyState.developmentBranch,
          developmentLevel: propertyState.developmentLevel,
          conditionBps: 10000,
        }]
      : [],
    playerState: {
      credits: 4100,
      influence: 100,
      commandPoints: 8,
      resourcesSettledAt: '2026-09-18T01:00:00Z',
    },
  };
}

describe('Grid onboarding property projection', () => {
  it('offers a neutral property only inside the player-controlled starter territory', () => {
    const result = projectGridOnboardingProperties(pkg, runtime(), playerId);

    expect(result.state).toBe('acquire-property');
    expect(result.options).toHaveLength(1);
    expect(result.options[0]).toMatchObject({
      slug: property.slug,
      territorySlug: starterSlug,
      owned: false,
      affordableToAcquire: true,
    });
  });
  it('offers all five level-one branches after the property is acquired', () => {
    const result = projectGridOnboardingProperties(
      pkg,
      runtime({
        ownerPlayerId: playerId,
        developmentBranch: null,
        developmentLevel: 0,
      }),
      playerId,
    );

    expect(result.state).toBe('develop-property');
    expect(result.options[0].developmentOptions.map((option) => option.branch))
      .toEqual(['commerce', 'influence', 'fortress', 'intel', 'prestige']);
    expect(result.options[0].developmentOptions.every((option) => option.level === 1))
      .toBe(true);
  });

  it('recognizes the first persisted development as upgrade completion', () => {
    const result = projectGridOnboardingProperties(
      pkg,
      runtime({
        ownerPlayerId: playerId,
        developmentBranch: 'commerce',
        developmentLevel: 1,
      }),
      playerId,
    );

    expect(result.state).toBe('upgrade-complete');
  });
});
describe('Grid onboarding property commands', () => {
  const seasonPort = {
    getCurrentSeason: vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      status: 'active',
    }),
  };
  const propertyRefPort = {
    resolvePropertyId: vi.fn().mockResolvedValue('property-id-1'),
  };

  it('resolves season and property IDs on the server before acquisition', async () => {
    const acquireProperty = vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      playerId,
      propertyId: 'property-id-1',
      propertySlug: property.slug,
      territoryId: 'territory-id-1',
      creditsSpent: 1500,
      commandPointsSpent: 2,
      credits: 2600,
      influence: 100,
      commandPoints: 6,
      eventId: 'event-1',
      acquiredAt: '2026-09-18T01:10:00Z',
    });
    const commandPort: GridPropertyCommandPort = {
      acquireProperty,
      developProperty: vi.fn(),
    };
    const result = await acquireGridOnboardingProperty(
      seasonPort,
      propertyRefPort,
      commandPort,
      {
        playerId,
        propertySlug: property.slug,
        idempotencyKey: 'onboarding-acquire-1',
        now: '2026-09-18T01:10:00Z',
      },
    );

    expect(acquireProperty).toHaveBeenCalledWith({
      seasonId: 'season-1',
      playerId,
      propertyId: 'property-id-1',
      idempotencyKey: 'onboarding-acquire-1',
      now: '2026-09-18T01:10:00Z',
    });
    expect(result).not.toHaveProperty('playerId');
    expect(result).not.toHaveProperty('seasonId');
    expect(result).not.toHaveProperty('propertyId');
    expect(result.propertySlug).toBe(property.slug);
  });
  it('forwards the selected branch through the guarded development command', async () => {
    const developProperty = vi.fn().mockResolvedValue({
      seasonId: 'season-1',
      cityId: 'city-1',
      playerId,
      propertyId: 'property-id-1',
      propertySlug: property.slug,
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
      developedAt: '2026-09-18T01:15:00Z',
      skylineEventId: null,
      skylineRuleIds: [],
    });
    const commandPort: GridPropertyCommandPort = {
      acquireProperty: vi.fn(),
      developProperty,
    };

    const result = await developGridOnboardingProperty(
      seasonPort,
      propertyRefPort,
      commandPort,
      {
        playerId,
        propertySlug: property.slug,
        branch: 'commerce',
        idempotencyKey: 'onboarding-develop-1',
        now: '2026-09-18T01:15:00Z',
      },
    );
    expect(developProperty).toHaveBeenCalledWith({
      seasonId: 'season-1',
      playerId,
      propertyId: 'property-id-1',
      branch: 'commerce',
      idempotencyKey: 'onboarding-develop-1',
      now: '2026-09-18T01:15:00Z',
    });
    expect(result).toMatchObject({
      propertySlug: property.slug,
      developmentBranch: 'commerce',
      developmentLevel: 1,
      skylineFormed: false,
    });
    expect(result).not.toHaveProperty('eventId');
  });
});
