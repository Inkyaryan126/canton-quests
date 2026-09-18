import { describe, expect, it } from 'vitest';
import {
  emptyGridPassport,
  projectGridPassport,
} from '../lib/grid/core/passport';
import type { GridPassportEvent } from '../lib/grid/core/passport-types';

const event = (value: GridPassportEvent): GridPassportEvent => value;

describe('Grid Passport core', () => {
  it('starts as an empty permanent cross-city record', () => {
    expect(emptyGridPassport()).toEqual({
      version: 1,
      homeCitySlug: null,
      citiesEntered: [],
      cityRanks: [],
      championships: [],
      peakRank: null,
      lifetimeTerritoriesControlled: 0,
      landmarkAchievements: [],
      allianceChampionships: [],
      seasonalTrophies: [],
      rareCosmetics: [],
      nationalReputation: 0,
      processedEventCount: 0,
      lastUpdatedAt: null,
    });
  });

  it('projects permanent history across multiple cities without moving local wealth', () => {
    const passport = projectGridPassport([
      event({
        id: '1',
        type: 'city-entered',
        citySlug: 'canton-oh',
        occurredAt: '2026-09-01T12:00:00.000Z',
      }),
      event({
        id: '2',
        type: 'home-city-set',
        citySlug: 'canton-oh',
        occurredAt: '2026-09-01T12:01:00.000Z',
      }),
      event({
        id: '3',
        type: 'reputation-earned',
        citySlug: 'canton-oh',
        amount: 40,
        reason: 'Founding Season placement',
        occurredAt: '2026-10-01T12:00:00.000Z',
      }),
      event({
        id: '4',
        type: 'city-entered',
        citySlug: 'akron-oh',
        occurredAt: '2026-10-05T12:00:00.000Z',
      }),
      event({
        id: '5',
        type: 'reputation-earned',
        citySlug: 'akron-oh',
        amount: 15,
        reason: 'Visitor objective',
        occurredAt: '2026-10-05T13:00:00.000Z',
      }),
    ]);

    expect(passport.homeCitySlug).toBe('canton-oh');
    expect(passport.citiesEntered).toEqual(['canton-oh', 'akron-oh']);
    expect(passport.nationalReputation).toBe(55);
    expect(passport).not.toHaveProperty('credits');
    expect(passport).not.toHaveProperty('influence');
    expect(passport).not.toHaveProperty('commandPoints');
  });

  it('tracks current city rank plus permanent peak rank', () => {
    const passport = projectGridPassport([
      event({
        id: 'rank-1',
        type: 'city-rank-recorded',
        citySlug: 'canton-oh',
        rank: 12,
        occurredAt: '2026-09-10T12:00:00.000Z',
      }),
      event({
        id: 'rank-2',
        type: 'city-rank-recorded',
        citySlug: 'canton-oh',
        rank: 4,
        occurredAt: '2026-09-11T12:00:00.000Z',
      }),
      event({
        id: 'rank-3',
        type: 'city-rank-recorded',
        citySlug: 'canton-oh',
        rank: 7,
        occurredAt: '2026-09-12T12:00:00.000Z',
      }),
      event({
        id: 'rank-4',
        type: 'city-rank-recorded',
        citySlug: 'akron-oh',
        rank: 2,
        occurredAt: '2026-10-12T12:00:00.000Z',
      }),
    ]);

    expect(passport.cityRanks).toEqual([
      {
        citySlug: 'akron-oh',
        currentRank: 2,
        peakRank: 2,
        updatedAt: '2026-10-12T12:00:00.000Z',
      },
      {
        citySlug: 'canton-oh',
        currentRank: 7,
        peakRank: 4,
        updatedAt: '2026-09-12T12:00:00.000Z',
      },
    ]);
    expect(passport.peakRank).toBe(2);
  });

  it('deduplicates event replay and permanent one-time records', () => {
    const territory = event({
      id: 'territory-event',
      type: 'territory-control-recorded',
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      territorySlug: 'arts-district',
      occurredAt: '2026-09-15T12:00:00.000Z',
    });
    const trophy = event({
      id: 'trophy-event',
      type: 'seasonal-trophy-earned',
      citySlug: 'canton-oh',
      seasonSlug: 'founding-season',
      achievementId: 'district-builder',
      label: 'District Builder',
      occurredAt: '2026-09-16T12:00:00.000Z',
    });

    const passport = projectGridPassport([
      territory,
      territory,
      trophy,
      {
        ...trophy,
        id: 'trophy-event-copy',
      },
    ]);

    expect(passport.processedEventCount).toBe(3);
    expect(passport.lifetimeTerritoriesControlled).toBe(1);
    expect(passport.seasonalTrophies).toHaveLength(1);
  });

  it('records the V1 permanent achievement categories', () => {
    const passport = projectGridPassport([
      event({
        id: 'champ',
        type: 'championship-earned',
        citySlug: 'canton-oh',
        seasonSlug: 'founding-season',
        achievementId: 'city-champion',
        label: 'Canton Champion',
        occurredAt: '2026-10-01T12:00:00.000Z',
      }),
      event({
        id: 'landmark',
        type: 'landmark-achievement-earned',
        citySlug: 'canton-oh',
        achievementId: 'mckinley-keeper',
        label: 'Monument Keeper',
        occurredAt: '2026-10-01T12:01:00.000Z',
      }),
      event({
        id: 'alliance',
        type: 'alliance-championship-earned',
        citySlug: 'canton-oh',
        seasonSlug: 'founding-season',
        achievementId: 'alliance-crown',
        label: 'Alliance Crown',
        occurredAt: '2026-10-01T12:02:00.000Z',
      }),
      event({
        id: 'cosmetic',
        type: 'rare-cosmetic-earned',
        cosmeticId: 'founder-gridline',
        label: 'Founder Gridline',
        occurredAt: '2026-10-01T12:03:00.000Z',
      }),
    ]);

    expect(passport.championships).toHaveLength(1);
    expect(passport.landmarkAchievements).toHaveLength(1);
    expect(passport.allianceChampionships).toHaveLength(1);
    expect(passport.rareCosmetics).toHaveLength(1);
  });

  it('is deterministic even when the event query arrives out of order', () => {
    const events: GridPassportEvent[] = [
      event({
        id: 'b',
        type: 'home-city-set',
        citySlug: 'akron-oh',
        occurredAt: '2026-10-01T12:00:00.000Z',
      }),
      event({
        id: 'a',
        type: 'home-city-set',
        citySlug: 'canton-oh',
        occurredAt: '2026-09-01T12:00:00.000Z',
      }),
      event({
        id: 'c',
        type: 'reputation-earned',
        amount: 25,
        reason: 'Career award',
        occurredAt: '2026-10-02T12:00:00.000Z',
      }),
    ];

    expect(projectGridPassport(events)).toEqual(
      projectGridPassport([...events].reverse()),
    );
    expect(projectGridPassport(events).homeCitySlug).toBe('akron-oh');
  });

  it('fails closed on malformed or conflicting authoritative events', () => {
    expect(() =>
      projectGridPassport([
        event({
          id: 'bad-rank',
          type: 'city-rank-recorded',
          citySlug: 'canton-oh',
          rank: 0,
          occurredAt: '2026-09-01T12:00:00.000Z',
        }),
      ]),
    ).toThrow(/rank/);

    expect(() =>
      projectGridPassport([
        event({
          id: 'same-id',
          type: 'reputation-earned',
          amount: 10,
          reason: 'A',
          occurredAt: '2026-09-01T12:00:00.000Z',
        }),
        event({
          id: 'same-id',
          type: 'reputation-earned',
          amount: 20,
          reason: 'B',
          occurredAt: '2026-09-01T12:00:00.000Z',
        }),
      ]),
    ).toThrow(/event id collision/);
  });
});
