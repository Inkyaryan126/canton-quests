import {
  emptyGridOnboardingFacts,
  projectGridOnboarding,
} from '../core/onboarding';
import type { GridOnboardingProjection } from '../core/onboarding-types';
import type {
  GridOnboardingEvidence,
  GridOnboardingStatusPort,
} from './onboarding-status-port';

function factsFromEvidence(evidence: GridOnboardingEvidence) {
  const facts = emptyGridOnboardingFacts();

  facts.homeCityConfirmed = evidence.homeCityConfirmed;
  facts.seasonJoined = evidence.seasonJoined;

  // Starter selection and the first structure currently have no standalone
  // persisted command. A successful starter claim proves both happened.
  facts.starterTerritorySelected = evidence.starterTerritoryClaimed;
  facts.starterTerritoryClaimed = evidence.starterTerritoryClaimed;
  facts.firstStructureRevealed = evidence.starterTerritoryClaimed;

  facts.firstUpgradeCompleted = evidence.firstUpgradeCompleted;
  facts.firstIncomeObserved = evidence.firstIncomeObserved;
  facts.tutorialContestCompleted = evidence.tutorialContestCompleted;
  facts.fullCityUnlocked = evidence.fullCityUnlocked;

  return facts;
}

export async function readGridOnboardingStatus(
  port: GridOnboardingStatusPort,
  playerId: string,
): Promise<GridOnboardingProjection> {
  if (!playerId.trim()) {
    throw new Error('Grid onboarding status requires playerId');
  }

  const evidence = await port.getEvidence(playerId);
  return projectGridOnboarding(factsFromEvidence(evidence));
}
