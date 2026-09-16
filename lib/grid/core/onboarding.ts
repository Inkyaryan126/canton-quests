import type {
  GridOnboardingFacts,
  GridOnboardingProjection,
  GridOnboardingStepId,
  GridOnboardingStepProjection,
} from './onboarding-types';

interface StepDefinition {
  id: GridOnboardingStepId;
  title: string;
  lesson: string;
  complete: (facts: GridOnboardingFacts) => boolean;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  {
    id: 'confirm-home-city',
    title: 'Confirm your Home City',
    lesson: 'Your Grid identity begins in a real city.',
    complete: (facts) => facts.homeCityConfirmed,
  },
  {
    id: 'join-season',
    title: 'Enter the active season',
    lesson: 'Joining creates your seasonal wallet and starting resources.',
    complete: (facts) => facts.seasonJoined,
  },
  {
    id: 'select-starter-territory',
    title: 'Choose a starter territory',
    lesson: 'Expansion starts from a limited, valid foothold.',
    complete: (facts) => facts.starterTerritorySelected,
  },
  {
    id: 'claim-first-territory',
    title: 'Claim your first territory',
    lesson: 'Territory turns the city map into persistent player state.',
    complete: (facts) => facts.starterTerritoryClaimed,
  },
  {
    id: 'reveal-first-structure',
    title: 'Watch your first structure rise',
    lesson: 'Your actions visibly change the city layer.',
    complete: (facts) => facts.firstStructureRevealed,
  },
  {
    id: 'complete-first-upgrade',
    title: 'Complete your first building upgrade',
    lesson: 'Build to increase the value and capability of your holdings.',
    complete: (facts) => facts.firstUpgradeCompleted,
  },
  {
    id: 'observe-first-income',
    title: 'Collect your first income',
    lesson: 'Owned and developed assets keep producing while you are away.',
    complete: (facts) => facts.firstIncomeObserved,
  },
  {
    id: 'complete-tutorial-contest',
    title: 'Complete a safe tutorial contest',
    lesson: 'Learn reinforce, contest, continue, and withdraw without risking the live city.',
    complete: (facts) => facts.tutorialContestCompleted,
  },
  {
    id: 'unlock-full-city',
    title: 'Unlock the full shared city',
    lesson: 'Claim → build → earn → reinforce → contest → expand.',
    complete: (facts) => facts.fullCityUnlocked,
  },
];

function completedFlags(facts: GridOnboardingFacts): boolean[] {
  return STEP_DEFINITIONS.map((step) => step.complete(facts));
}

function invariantViolations(flags: boolean[]): string[] {
  const violations: string[] = [];
  let foundIncomplete = false;

  flags.forEach((complete, index) => {
    if (!complete) {
      foundIncomplete = true;
      return;
    }
    if (foundIncomplete) {
      violations.push(
        `${STEP_DEFINITIONS[index].id} is complete before an earlier onboarding step`,
      );
    }
  });

  return violations;
}

export function projectGridOnboarding(
  facts: GridOnboardingFacts,
): GridOnboardingProjection {
  const flags = completedFlags(facts);

  const steps: GridOnboardingStepProjection[] = STEP_DEFINITIONS.map(
    (definition, index) => ({
      id: definition.id,
      ordinal: index + 1,
      title: definition.title,
      lesson: definition.lesson,
      complete: flags[index],
      available: index === 0 || flags.slice(0, index).every(Boolean),
    }),
  );

  const completedCount = flags.filter(Boolean).length;
  const nextStep = steps.find((step) => !step.complete && step.available) ?? null;
  const readyForFullCityUnlock = flags.slice(0, -1).every(Boolean);

  return {
    complete: flags.every(Boolean),
    completedCount,
    totalSteps: steps.length,
    nextStep,
    readyForFullCityUnlock,
    invariantViolations: invariantViolations(flags),
    steps,
  };
}

export function emptyGridOnboardingFacts(): GridOnboardingFacts {
  return {
    homeCityConfirmed: false,
    seasonJoined: false,
    starterTerritorySelected: false,
    starterTerritoryClaimed: false,
    firstStructureRevealed: false,
    firstUpgradeCompleted: false,
    firstIncomeObserved: false,
    tutorialContestCompleted: false,
    fullCityUnlocked: false,
  };
}
