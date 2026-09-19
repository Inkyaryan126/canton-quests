import { describe, expect, it, vi } from 'vitest';
import type { GridEconomyCommandPort, GridPlayerSeasonState } from '../lib/grid/server/economy-port';
import type { GridOnboardingHomeCityPort } from '../lib/grid/server/onboarding-home-city-port';
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


function homeCityPort(confirmed = true): GridOnboardingHomeCityPort {
  return {
    isHomeCityConfirmed: vi.fn().mockResolvedValue(confirmed),
    confirmHomeCity: vi.fn(),
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
      joinGridOnboardingSeason(homeCityPort(), seasonPort, economy, request),
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
      joinGridOnboardingSeason(homeCityPort(), surgePort, economyPort(), request),
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
        joinGridOnboardingSeason(homeCityPort(), port, economyPort(), request),
      ).rejects.toThrow('season is not active');
    }
  });

  it('requires Home City confirmation before resolving season or wallet state', async () => {
    const home = homeCityPort(false);
    const seasonPort: GridOnboardingSeasonPort = {
      getCurrentSeason: vi.fn(),
    };
    const economy = economyPort();

    await expect(
      joinGridOnboardingSeason(home, seasonPort, economy, request),
    ).rejects.toThrow('Home City must be confirmed before joining');

    expect(seasonPort.getCurrentSeason).not.toHaveBeenCalled();
    expect(economy.joinSeason).not.toHaveBeenCalled();
  });

  it('preserves a persisted repeat join without granting another starting wallet', async () => {
    const seasonPort: GridOnboardingSeasonPort = {
      getCurrentSeason: vi.fn().mockResolvedValue({
        seasonId: joinedState.seasonId,
        status: 'active',
      }),
    };
    const economy = economyPort();
    vi.mocked(economy.joinSeason)
      .mockResolvedValueOnce(joinedState)
      .mockResolvedValueOnce({ ...joinedState, joined: false, eventId: null });

    await expect(
      joinGridOnboardingSeason(homeCityPort(), seasonPort, economy, request),
    ).resolves.toMatchObject({ joined: true, credits: 5000 });
    await expect(
      joinGridOnboardingSeason(homeCityPort(), seasonPort, economy, {
        ...request,
        idempotencyKey: 'onboarding:join:retry',
      }),
    ).resolves.toMatchObject({ joined: false, credits: 5000 });

    expect(economy.joinSeason).toHaveBeenCalledTimes(2);
  });

  it('fails closed when persistence cannot complete the atomic join', async () => {
    const seasonPort: GridOnboardingSeasonPort = {
      getCurrentSeason: vi.fn().mockResolvedValue({
        seasonId: joinedState.seasonId,
        status: 'active',
      }),
    };
    const economy = economyPort();
    vi.mocked(economy.joinSeason).mockRejectedValue(
      new Error('Failed to join Grid season: ECONOMY_NOT_CONFIGURED'),
    );

    await expect(
      joinGridOnboardingSeason(homeCityPort(), seasonPort, economy, request),
    ).rejects.toThrow('ECONOMY_NOT_CONFIGURED');
    expect(economy.settleResources).not.toHaveBeenCalled();
  });

  it('rejects persisted state that does not match the authenticated request', async () => {
    const seasonPort: GridOnboardingSeasonPort = {
      getCurrentSeason: vi.fn().mockResolvedValue({
        seasonId: joinedState.seasonId,
        status: 'active',
      }),
    };
    const economy = economyPort();
    vi.mocked(economy.joinSeason).mockResolvedValue({
      ...joinedState,
      playerId: '70000000-0000-4000-8000-000000000099',
    });

    await expect(
      joinGridOnboardingSeason(homeCityPort(), seasonPort, economy, request),
    ).rejects.toThrow('returned state for a different player');
  });

  it('validates player, idempotency, and time before touching persistence', async () => {
    const seasonPort: GridOnboardingSeasonPort = {
      getCurrentSeason: vi.fn(),
    };
    const economy = economyPort();

    await expect(
      joinGridOnboardingSeason(homeCityPort(), seasonPort, economy, {
        ...request,
        playerId: ' ',
      }),
    ).rejects.toThrow('requires playerId');

    await expect(
      joinGridOnboardingSeason(homeCityPort(), seasonPort, economy, {
        ...request,
        idempotencyKey: ' ',
      }),
    ).rejects.toThrow('non-empty idempotency key');

    await expect(
      joinGridOnboardingSeason(homeCityPort(), seasonPort, economy, {
        ...request,
        now: 'not-a-date',
      }),
    ).rejects.toThrow('valid now timestamp');

    expect(seasonPort.getCurrentSeason).not.toHaveBeenCalled();
    expect(economy.joinSeason).not.toHaveBeenCalled();
  });
});
