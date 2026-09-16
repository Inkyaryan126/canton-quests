export interface GridOnboardingEvidence {
  homeCityConfirmed: boolean;
  seasonJoined: boolean;
  starterTerritoryClaimed: boolean;
  firstUpgradeCompleted: boolean;
  firstIncomeObserved: boolean;
  tutorialContestCompleted: boolean;
  fullCityUnlocked: boolean;
}

export interface GridOnboardingStatusPort {
  getEvidence(playerId: string): Promise<GridOnboardingEvidence>;
}
