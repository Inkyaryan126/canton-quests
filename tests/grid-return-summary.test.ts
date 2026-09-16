import { describe, expect, it, vi } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { resolveTerritoryIncomeRate } from '../lib/grid/core/resources';
import type { GridReturnSummaryPort } from '../lib/grid/server/return-summary-port';
import { buildGridReturnSummary } from '../lib/grid/server/return-summary-service';

const maxCommandPoints =
  cantonFoundingSeasonPackage.seasonTemplate.balance.maxCommandPoints;

const context = {
  cityId: 'city-secret-id',
  seasonId: 'season-secret-id',
  lastActiveAt: '2026-09-16T07:00:00.000Z',
  resources: {
    credits: 1000,
    influence: 100,
    commandPoints: maxCommandPoints,
    commandPointsUpdatedAt: '2026-09-16T07:00:00.000Z',
    resourcesSettledAt: '2026-09-16T07:00:00.000Z',
    creditsAccrualRemainder: 0,
    influenceAccrualRemainder: 0,
    ownedTerritorySlugs: [],
    ownedProperties: [],
  },
};

describe('Grid return summary', () => {
  it('summarizes city changes and player-specific outcomes without exposing identities', async () => {
    const port: GridReturnSummaryPort = {
      getContext: vi.fn().mockResolvedValue(context),
      listActivity: vi.fn().mockResolvedValue({
        truncated: false,
        events: [
          {
            eventType: 'grid:contest_session_round_resolved',
            entityType: 'contest',
            createdAt: '2026-09-16T08:10:00.000Z',
            viewerRole: 'defender',
            contestOutcome: 'defended',
          },
          {
            eventType: 'grid:contest_started',
            entityType: 'contest',
            createdAt: '2026-09-16T08:00:00.000Z',
            viewerRole: 'defender',
            contestOutcome: null,
          },
          {
            eventType: 'grid:property_developed',
            entityType: 'property',
            createdAt: '2026-09-16T07:55:00.000Z',
            viewerRole: 'actor',
            contestOutcome: null,
          },
          {
            eventType: 'grid:territory_claimed',
            entityType: 'territory',
            createdAt: '2026-09-16T07:40:00.000Z',
            viewerRole: 'none',
            contestOutcome: null,
          },
          {
            eventType: 'grid:contest_auto_retreat_capture',
            entityType: 'territory',
            createdAt: '2026-09-16T07:20:00.000Z',
            viewerRole: 'attacker',
            contestOutcome: null,
          },
        ],
      }),
    };

    const summary = await buildGridReturnSummary(
      port,
      cantonFoundingSeasonPackage,
      'viewer-secret-id',
      '2026-09-16T08:15:00.000Z',
    );

    expect(summary).not.toBeNull();
    expect(summary?.timeAwayMinutes).toBe(75);
    expect(summary?.pendingResources).toEqual({
      creditsProduced: 0,
      influenceGenerated: 0,
      commandPointsRestored: 0,
      projectedCredits: 1000,
      projectedInfluence: 100,
      projectedCommandPoints: maxCommandPoints,
      billableMinutes: 75,
      offlineAccrualCapped: false,
    });
    expect(summary?.cityActivity).toEqual({
      territoryClaims: 1,
      propertyAcquisitions: 0,
      propertyDevelopments: 1,
      contestsStarted: 1,
      contestRounds: 1,
      territoryCaptures: 1,
    });
    expect(summary?.yourActivity).toEqual({
      territoryClaims: 0,
      propertyAcquisitions: 0,
      propertyDevelopments: 1,
      attacksStarted: 0,
      defensesFaced: 1,
      contestsWon: 2,
      contestsLost: 0,
    });
    expect(summary?.highlights[0]?.message).toBe(
      'You successfully defended a territory.',
    );
    expect(
      summary?.highlights.some((item) => item.message.includes('auto-retreated')),
    ).toBe(true);

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('viewer-secret-id');
    expect(serialized).not.toContain('city-secret-id');
    expect(serialized).not.toContain('season-secret-id');
  });

  it('previews exact pending territory income and Command Point regeneration without mutating state', async () => {
    const territorySlug = cantonFoundingSeasonPackage.territories[0].slug;
    const economy = cantonFoundingSeasonPackage.seasonTemplate.economy!;
    const rate = resolveTerritoryIncomeRate(economy, territorySlug);
    const regenMinutes =
      cantonFoundingSeasonPackage.seasonTemplate.balance.commandPointRegenMinutes;

    const resourceContext = {
      ...context,
      resources: {
        ...context.resources,
        credits: 100,
        influence: 20,
        commandPoints: 0,
        ownedTerritorySlugs: [territorySlug],
      },
    };
    const port: GridReturnSummaryPort = {
      getContext: vi.fn().mockResolvedValue(resourceContext),
      listActivity: vi.fn().mockResolvedValue({ truncated: false, events: [] }),
    };

    const summary = await buildGridReturnSummary(
      port,
      cantonFoundingSeasonPackage,
      'viewer',
      '2026-09-16T08:00:00.000Z',
    );

    expect(summary?.pendingResources.creditsProduced).toBe(rate.creditsPerHour);
    expect(summary?.pendingResources.influenceGenerated).toBe(
      rate.influencePerHour,
    );
    expect(summary?.pendingResources.projectedCredits).toBe(
      100 + rate.creditsPerHour,
    );
    expect(summary?.pendingResources.projectedInfluence).toBe(
      20 + rate.influencePerHour,
    );
    expect(summary?.pendingResources.commandPointsRestored).toBe(
      Math.min(Math.floor(60 / regenMinutes), maxCommandPoints),
    );
    expect(summary?.pendingResources.billableMinutes).toBe(60);
    expect(summary?.pendingResources.offlineAccrualCapped).toBe(false);
  });

  it('shows when pending income has reached the configured offline accrual cap', async () => {
    const territorySlug = cantonFoundingSeasonPackage.territories[0].slug;
    const economy = cantonFoundingSeasonPackage.seasonTemplate.economy!;
    const cappedContext = {
      ...context,
      lastActiveAt: '2026-09-15T00:00:00.000Z',
      resources: {
        ...context.resources,
        resourcesSettledAt: '2026-09-15T00:00:00.000Z',
        commandPointsUpdatedAt: '2026-09-15T00:00:00.000Z',
        ownedTerritorySlugs: [territorySlug],
      },
    };
    const port: GridReturnSummaryPort = {
      getContext: vi.fn().mockResolvedValue(cappedContext),
      listActivity: vi.fn().mockResolvedValue({ truncated: false, events: [] }),
    };

    const summary = await buildGridReturnSummary(
      port,
      cantonFoundingSeasonPackage,
      'viewer',
      '2026-09-16T08:00:00.000Z',
    );

    expect(summary?.pendingResources.offlineAccrualCapped).toBe(true);
    expect(summary?.pendingResources.billableMinutes).toBe(
      economy.offlineAccrualCapMinutes,
    );
  });

  it('returns null for a player who has not joined the Grid season', async () => {
    const port: GridReturnSummaryPort = {
      getContext: vi.fn().mockResolvedValue(null),
      listActivity: vi.fn(),
    };

    await expect(
      buildGridReturnSummary(
        port,
        cantonFoundingSeasonPackage,
        'viewer',
        '2026-09-16T08:15:00.000Z',
      ),
    ).resolves.toBeNull();
    expect(port.listActivity).not.toHaveBeenCalled();
  });

  it('preserves truncation state and caps player highlights', async () => {
    const events = Array.from({ length: 10 }, (_, index) => ({
      eventType: 'grid:property_developed',
      entityType: 'property',
      createdAt: `2026-09-16T08:0${9 - index}:00.000Z`,
      viewerRole: 'actor' as const,
      contestOutcome: null,
    }));

    const port: GridReturnSummaryPort = {
      getContext: vi.fn().mockResolvedValue(context),
      listActivity: vi.fn().mockResolvedValue({
        truncated: true,
        events,
      }),
    };

    const summary = await buildGridReturnSummary(
      port,
      cantonFoundingSeasonPackage,
      'viewer',
      '2026-09-16T08:15:00.000Z',
    );

    expect(summary?.truncated).toBe(true);
    expect(summary?.eventsScanned).toBe(10);
    expect(summary?.yourActivity.propertyDevelopments).toBe(10);
    expect(summary?.highlights).toHaveLength(6);
  });

  it('validates player and generated-at inputs before querying storage', async () => {
    const port: GridReturnSummaryPort = {
      getContext: vi.fn(),
      listActivity: vi.fn(),
    };

    await expect(
      buildGridReturnSummary(
        port,
        cantonFoundingSeasonPackage,
        ' ',
        '2026-09-16T08:15:00.000Z',
      ),
    ).rejects.toThrow('requires playerId');
    await expect(
      buildGridReturnSummary(
        port,
        cantonFoundingSeasonPackage,
        'viewer',
        'not-a-date',
      ),
    ).rejects.toThrow('valid generatedAt timestamp');
    expect(port.getContext).not.toHaveBeenCalled();
  });
});
