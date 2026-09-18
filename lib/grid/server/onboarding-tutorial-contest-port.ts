export interface GridOnboardingTutorialContestContext {
  cityId: string;
  seasonId: string;
  seasonStatus: string;
}

export interface GridOnboardingTutorialContestPort {
  getContext(playerId: string): Promise<GridOnboardingTutorialContestContext | null>;
}
