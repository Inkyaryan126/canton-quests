import { describe, expect, it, vi } from 'vitest';
import type { GridOnboardingHomeCityPort } from '../lib/grid/server/onboarding-home-city-port';
import { confirmGridOnboardingHomeCity } from '../lib/grid/server/onboarding-home-city-service';

describe('Grid onboarding Home City confirmation', () => {
  it('confirms the configured city and hides the internal city id', async () => {
    const port: GridOnboardingHomeCityPort = {
      isHomeCityConfirmed: vi.fn(),
      confirmHomeCity: vi.fn().mockResolvedValue({
        cityId: 'secret-city-id',
        citySlug: 'canton-oh',
        confirmed: true,
      }),
    };

    await expect(
      confirmGridOnboardingHomeCity(
        port,
        'player-1',
        '2026-09-16T18:20:00.000Z',
      ),
    ).resolves.toEqual({
      citySlug: 'canton-oh',
      confirmed: true,
    });

    expect(port.confirmHomeCity).toHaveBeenCalledWith(
      'player-1',
      '2026-09-16T18:20:00.000Z',
    );
  });

  it('validates player and server time before persistence', async () => {
    const port: GridOnboardingHomeCityPort = {
      isHomeCityConfirmed: vi.fn(),
      confirmHomeCity: vi.fn(),
    };

    await expect(
      confirmGridOnboardingHomeCity(port, ' ', '2026-09-16T18:20:00.000Z'),
    ).rejects.toThrow('requires playerId');
    await expect(
      confirmGridOnboardingHomeCity(port, 'player-1', 'not-a-date'),
    ).rejects.toThrow('valid now timestamp');
    expect(port.confirmHomeCity).not.toHaveBeenCalled();
  });
});
