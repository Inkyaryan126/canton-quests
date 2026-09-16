export const GRID_ONBOARDING_STEP_IDS = [
  'confirm-home-city',
  'join-season',
  'select-starter-territory',
  'claim-first-territory',
  'reveal-first-structure',
  'complete-first-upgrade',
  'observe-first-income',
  'complete-tutorial-contest',
  'unlock-full-city',
] as const;

export type GridOnboardingStepId =
  (typeof GRID_ONBOARDING_STEP_IDS)[number];

export interface GridOnboardingFacts {
  homeCityConfirmed: boolean;
  seasonJoined: boolean;
  starterTerritorySelected: boolean;
  starterTerritoryClaimed: boolean;
  firstStructureRevealed: boolean;
  firstUpgradeCompleted: boolean;
  firstIncomeObserved: boolean;
  tutorialContestCompleted: boolean;
  fullCityUnlocked: boolean;
}

export interface GridOnboardingStepProjection {
  id: GridOnboardingStepId;
  ordinal: number;
  title: string;
  lesson: string;
  complete: boolean;
  available: boolean;
}

export interface GridOnboardingProjection {
  complete: boolean;
  completedCount: number;
  totalSteps: number;
  nextStep: GridOnboardingStepProjection | null;
  readyForFullCityUnlock: boolean;
  invariantViolations: string[];
  steps: GridOnboardingStepProjection[];
}
