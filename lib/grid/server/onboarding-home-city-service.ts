import type {
  GridOnboardingHomeCityPort,
  GridOnboardingHomeCityResult,
} from './onboarding-home-city-port';

export async function confirmGridOnboardingHomeCity(
  port: GridOnboardingHomeCityPort,
  playerId: string,
  now: string,
): Promise<GridOnboardingHomeCityResult> {
  if (!playerId.trim()) {
    throw new Error('Grid onboarding Home City confirmation requires playerId');
  }
  if (!Number.isFinite(Date.parse(now))) {
    throw new Error(
      'Grid onboarding Home City confirmation requires a valid now timestamp',
    );
  }

  const result = await port.confirmHomeCity(playerId, now);
  return {
    cityId: result.cityId,
    citySlug: result.citySlug,
    confirmed: result.confirmed,
  };
}
