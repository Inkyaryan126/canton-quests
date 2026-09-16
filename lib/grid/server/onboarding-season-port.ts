export interface GridOnboardingSeasonRef {
  seasonId: string;
  status: string;
}

export interface GridOnboardingSeasonPort {
  getCurrentSeason(): Promise<GridOnboardingSeasonRef | null>;
}
