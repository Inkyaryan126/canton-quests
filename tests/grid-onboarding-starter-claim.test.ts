import { describe, expect, it, vi } from 'vitest';
import type { GridOnboardingSeasonPort } from '../lib/grid/server/onboarding-season-port';
import type { GridOnboardingStarterClaimPort } from '../lib/grid/server/onboarding-starter-claim-port';
import { claimGridOnboardingStarterTerritory } from '../lib/grid/server/onboarding-starter-claim-service';

const request = {
  playerId: '80000000-0000-4000-8000-000000000001',
  territoryId: '80000000-0000-4000-8000-000000000002',
  idempotencyKey: 'onboarding:starter:one',
  now: '2026-09-16T11:30:00.000Z',
};

const seasonPort: GridOnboardingSeasonPort = {
  getCurrentSeason: vi.fn().mockResolvedValue({
    seasonId: '80000000-0000-4000-8000-000000000003',
    status: 'active',
  }),
};

function claimPort(claimMode: 'starter' | 'adjacent' = 'starter'): GridOnboardingStarterClaimPort {
  return {
    claimStarterTerritory: vi.fn().mockResolvedValue({
      seasonId: '80000000-0000-4000-8000-000000000003',
      cityId: '80000000-0000-4000-8000-000000000004',
      playerId: request.playerId,
      territoryId: request.territoryId,
      territorySlug: 'starter-block',
      claimedAt: request.now,
      claimMode,
      creditsSpent: 900,
      commandPointsSpent: 2,
      credits: 4100,
      influence: 100,
      commandPoints: 8,
      eventId: '80000000-0000-4000-8000-000000000005',
    }),
  };
}

describe('Grid onboarding starter territory claim', () => {
  it('resolves the current season and returns a sanitized starter result', async () => {
    const port = claimPort();

    await expect(
      claimGridOnboardingStarterTerritory(seasonPort, port, request),
    ).resolves.toEqual({
      territoryId: request.territoryId,
      territorySlug: 'starter-block',
      claimedAt: request.now,
      creditsSpent: 900,
      commandPointsSpent: 2,
      credits: 4100,
      influence: 100,
      commandPoints: 8,
      eventId: '80000000-0000-4000-8000-000000000005',
    });

    expect(port.claimStarterTerritory).toHaveBeenCalledWith({
      seasonId: '80000000-0000-4000-8000-000000000003',
      playerId: request.playerId,
      territoryId: request.territoryId,
      idempotencyKey: request.idempotencyKey,
      now: request.now,
    });
  });

  it('rejects a non-starter response defensively', async () => {
    await expect(
      claimGridOnboardingStarterTerritory(
        seasonPort,
        claimPort('adjacent'),
        request,
      ),
    ).rejects.toThrow('non-starter claim mode');
  });

  it('rejects inactive seasons before calling the claim port', async () => {
    const inactiveSeason: GridOnboardingSeasonPort = {
      getCurrentSeason: vi.fn().mockResolvedValue({
        seasonId: 'season',
        status: 'draft',
      }),
    };
    const port = claimPort();

    await expect(
      claimGridOnboardingStarterTerritory(inactiveSeason, port, request),
    ).rejects.toThrow('season is not active');
    expect(port.claimStarterTerritory).not.toHaveBeenCalled();
  });

  it('validates player, territory, idempotency, and command time first', async () => {
    const port = claimPort();

    for (const invalid of [
      { ...request, playerId: ' ' },
      { ...request, territoryId: ' ' },
      { ...request, idempotencyKey: ' ' },
      { ...request, now: 'not-a-date' },
    ]) {
      await expect(
        claimGridOnboardingStarterTerritory(seasonPort, port, invalid),
      ).rejects.toThrow();
    }

    expect(port.claimStarterTerritory).not.toHaveBeenCalled();
  });
});
