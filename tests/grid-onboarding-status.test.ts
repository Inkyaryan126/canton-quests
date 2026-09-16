import { describe, expect, it, vi } from 'vitest';
import type { GridOnboardingStatusPort } from '../lib/grid/server/onboarding-status-port';
import { readGridOnboardingStatus } from '../lib/grid/server/onboarding-status-service';

function portWith(
  evidence: Awaited<ReturnType<GridOnboardingStatusPort['getEvidence']>>,
): GridOnboardingStatusPort {
  return { getEvidence: vi.fn().mockResolvedValue(evidence) };
}

const emptyEvidence = {
  homeCityConfirmed: false,
  seasonJoined: false,
  starterTerritoryClaimed: false,
  firstUpgradeCompleted: false,
  firstIncomeObserved: false,
  tutorialContestCompleted: false,
  fullCityUnlocked: false,
};

describe('Grid onboarding status derivation', () => {
  it('starts with Home City when no persisted evidence exists', async () => {
    const status = await readGridOnboardingStatus(
      portWith(emptyEvidence),
      'player-1',
    );

    expect(status.completedCount).toBe(0);
    expect(status.nextStep?.id).toBe('confirm-home-city');
  });

  it('treats a successful starter claim as selection, claim, and structure reveal', async () => {
    const status = await readGridOnboardingStatus(
      portWith({
        ...emptyEvidence,
        homeCityConfirmed: true,
        seasonJoined: true,
        starterTerritoryClaimed: true,
      }),
      'player-1',
    );

    expect(status.steps.slice(0, 5).every((step) => step.complete)).toBe(true);
    expect(status.completedCount).toBe(5);
    expect(status.nextStep?.id).toBe('complete-first-upgrade');
  });

  it('advances from real upgrade and income evidence to the dedicated tutorial contest', async () => {
    const status = await readGridOnboardingStatus(
      portWith({
        ...emptyEvidence,
        homeCityConfirmed: true,
        seasonJoined: true,
        starterTerritoryClaimed: true,
        firstUpgradeCompleted: true,
        firstIncomeObserved: true,
      }),
      'player-1',
    );

    expect(status.completedCount).toBe(7);
    expect(status.nextStep?.id).toBe('complete-tutorial-contest');
    expect(status.readyForFullCityUnlock).toBe(false);
  });

  it('requires tutorial completion before full-city unlock becomes available', async () => {
    const status = await readGridOnboardingStatus(
      portWith({
        ...emptyEvidence,
        homeCityConfirmed: true,
        seasonJoined: true,
        starterTerritoryClaimed: true,
        firstUpgradeCompleted: true,
        firstIncomeObserved: true,
        tutorialContestCompleted: true,
      }),
      'player-1',
    );

    expect(status.readyForFullCityUnlock).toBe(true);
    expect(status.nextStep?.id).toBe('unlock-full-city');
  });

  it('projects a fully completed onboarding only from complete persisted evidence', async () => {
    const status = await readGridOnboardingStatus(
      portWith({
        ...emptyEvidence,
        homeCityConfirmed: true,
        seasonJoined: true,
        starterTerritoryClaimed: true,
        firstUpgradeCompleted: true,
        firstIncomeObserved: true,
        tutorialContestCompleted: true,
        fullCityUnlocked: true,
      }),
      'player-1',
    );

    expect(status.complete).toBe(true);
    expect(status.completedCount).toBe(9);
    expect(status.nextStep).toBeNull();
  });

  it('rejects a blank player id before reading persistence', async () => {
    const port = portWith(emptyEvidence);

    await expect(readGridOnboardingStatus(port, ' ')).rejects.toThrow(
      'requires playerId',
    );
    expect(port.getEvidence).not.toHaveBeenCalled();
  });
});
