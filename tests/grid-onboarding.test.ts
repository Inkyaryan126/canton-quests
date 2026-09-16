import { describe, expect, it } from 'vitest';
import {
  emptyGridOnboardingFacts,
  projectGridOnboarding,
} from '../lib/grid/core/onboarding';

describe('Grid first-session onboarding projector', () => {
  it('starts at Home City and exposes only the first available step', () => {
    const projection = projectGridOnboarding(emptyGridOnboardingFacts());

    expect(projection.totalSteps).toBe(9);
    expect(projection.completedCount).toBe(0);
    expect(projection.nextStep?.id).toBe('confirm-home-city');
    expect(projection.steps.filter((step) => step.available).map((step) => step.id))
      .toEqual(['confirm-home-city']);
    expect(projection.invariantViolations).toEqual([]);
  });

  it('advances through the core claim → build → earn → contest lesson in order', () => {
    const facts = {
      ...emptyGridOnboardingFacts(),
      homeCityConfirmed: true,
      seasonJoined: true,
      starterTerritorySelected: true,
      starterTerritoryClaimed: true,
      firstStructureRevealed: true,
      firstUpgradeCompleted: true,
    };

    const projection = projectGridOnboarding(facts);

    expect(projection.completedCount).toBe(6);
    expect(projection.nextStep?.id).toBe('observe-first-income');
    expect(projection.readyForFullCityUnlock).toBe(false);
  });

  it('becomes ready to unlock the full city only after the safe tutorial contest', () => {
    const facts = {
      ...emptyGridOnboardingFacts(),
      homeCityConfirmed: true,
      seasonJoined: true,
      starterTerritorySelected: true,
      starterTerritoryClaimed: true,
      firstStructureRevealed: true,
      firstUpgradeCompleted: true,
      firstIncomeObserved: true,
      tutorialContestCompleted: true,
    };

    const projection = projectGridOnboarding(facts);

    expect(projection.readyForFullCityUnlock).toBe(true);
    expect(projection.nextStep?.id).toBe('unlock-full-city');
    expect(projection.complete).toBe(false);
  });

  it('marks the flow complete only after full-city unlock', () => {
    const facts = {
      homeCityConfirmed: true,
      seasonJoined: true,
      starterTerritorySelected: true,
      starterTerritoryClaimed: true,
      firstStructureRevealed: true,
      firstUpgradeCompleted: true,
      firstIncomeObserved: true,
      tutorialContestCompleted: true,
      fullCityUnlocked: true,
    };

    const projection = projectGridOnboarding(facts);

    expect(projection.complete).toBe(true);
    expect(projection.completedCount).toBe(9);
    expect(projection.nextStep).toBeNull();
    expect(projection.invariantViolations).toEqual([]);
  });

  it('detects out-of-order facts without silently unlocking later steps', () => {
    const projection = projectGridOnboarding({
      ...emptyGridOnboardingFacts(),
      firstUpgradeCompleted: true,
      tutorialContestCompleted: true,
    });

    expect(projection.nextStep?.id).toBe('confirm-home-city');
    expect(projection.steps.find((step) => step.id === 'complete-first-upgrade')?.available)
      .toBe(false);
    expect(projection.invariantViolations).toEqual([
      'complete-first-upgrade is complete before an earlier onboarding step',
      'complete-tutorial-contest is complete before an earlier onboarding step',
    ]);
  });
});
