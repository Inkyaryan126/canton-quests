import { describe, expect, it, vi } from 'vitest';
import type { GridEconomyCommandPort, GridPlayerSeasonState } from '../lib/grid/server/economy-port';
import type { GridOnboardingSeasonPort } from '../lib/grid/server/onboarding-season-port';
import { joinGridOnboardingSeason } from '../lib/grid/server/onboarding-join-service';

const request = {
  playerId: '70000000-0000-4000-8000-000000000001',
  idempotencyKey: 'onboarding:join:one',
  now: '2026-09-16T10:30:00.000Z',
};

const joinedState: GridPlayerSeasonState = {
  seasonId: '70000000-0000-4000-8000-000000000002',
  cityId: '70000000-0000-4000-8000-000000000003',
  playerId: request.playerId,
  credits: 5000,
  influence: 100,
  commandPoints: 10,
  commandPointsUpdatedAt: request.now,
  resourcesSettledAt: request.now,
  creditsAccrualRemainder: 0,
  influenceAccrualRemainder: 0,
  joined: true,
  eventId: '70000000-0000-4000-8000-000000000004',
};

function economyPort(): GridEconomyCommandPort {
  return {
    joinSeason: vi.fn().mockResolvedValue(joinedState),
    settleResources: vi.fn(),
  };
}

describe('Grid onboarding season join', () => {
  it('resolves the active season and forwards an idempotent server command', async () => {
    const seasonPort: GridOnboardingSeasonPort = {
      getCurrentSeason: vi.fn().mockResolvedValue({
        seasonId: joinedState.seasonId,
        status: 'active',
      }),
    };
    const economy = economyPort();

    await expect(
      joinGridOnboardingSeason(seasonPort, economy, request),
    ).resolves.toEqual({
      joined: true,
      credits: 5000,
      influence: 100,
      commandPoints: 10,
      resourcesSettledAt: request.now,
    });

    expect(economy.joinSeason).toHaveBeenCalledWith({
      seasonId: joinedState.seasonId,
      playerId: request.playerId,
      idempotencyKey: request.idempotencyKey,
      now: request.now,
    });
  });

  it('allows surge seasons but rejects missing or non-playable seasons', async () => {
    const surgePort: GridOnboardingSeasonPort = {
      getCurrentSeason: vi.fn().mockResolvedValue({
        seasonId: joinedState.seasonId,
        status: 'surge',
      }),
    };
    await expect(
      joinGridOnboardingSeason(surgePort, economyPort(), request),
    ).resolves.toMatchObject({ joined: true });

    for (const season of [
      null,
      { seasonId: joinedState.seasonId, status: 'draft' },
      { seasonId: joinedState.seasonId, status: 'complete' },
    ]) {
      const port: GridOnboardingSeasonPort = {
        getCurrentSeason: vi.fn().mockResolvedValue(season),
      };
      await expect(
        joinGridOnboardingSeason(port, economyPort(), request),
      ).rejects.toThrow('season is not active');
    }
  });

  it('validates player, idempotency, and time before touching persistence', async () => {
    const seasonPort: GridOnboardingSeasonPort = {
      getCurrentSeason: vi.fn(),
    };
    const economy = economyPort();

    await expect(
      joinGridOnboardingSeason(seasonPort, economy, {
        ...request,
        playerId: ' ',
      }),
    ).rejects.toThrow('requires playerId');

    await expect(
      joinGridOnboardingSeason(seasonPort, economy, {
        ...request,
        idempotencyKey: ' ',
      }),
    ).rejects.toThrow('non-empty idempotency key');

    await expect(
      joinGridOnboardingSeason(seasonPort, economy, {
        ...request,
        now: 'not-a-date',
      }),
    ).rejects.toThrow('valid now timestamp');

    expect(seasonPort.getCurrentSeason).not.toHaveBeenCalled();
    expect(economy.joinSeason).not.toHaveBeenCalled();
  });
});
