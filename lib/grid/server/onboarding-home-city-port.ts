export interface GridOnboardingHomeCityResult {
  cityId: string;
  citySlug: string;
  confirmed: boolean;
}

export interface GridOnboardingHomeCityPort {
  isHomeCityConfirmed(playerId: string): Promise<boolean>;
  confirmHomeCity(
    playerId: string,
    now: string,
  ): Promise<GridOnboardingHomeCityResult>;
}
