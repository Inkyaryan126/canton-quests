import type { GridContestConfig } from '../../core/contest-types';

/**
 * Founding Season contest tuning.
 * Core owns the rules; Canton owns only season balance values.
 */
export const cantonFoundingSeasonContest: GridContestConfig = {
  dieSides: 6,
  influenceLossPerComparison: 10,
  tiesFavorDefender: true,
  // Initial tuning seed: a capture keeps roughly two-thirds of development,
  // damages condition by 20%, and never pushes a healthier property below 40%.
  takeoverDamage: {
    developmentRetentionBps: 6_667,
    conditionDamageBps: 2_000,
    conditionFloorBps: 4_000,
  },
  attacker: {
    maxDice: 3,
    bands: [
      { minCommittedInfluence: 10, dice: 1 },
      { minCommittedInfluence: 30, dice: 2 },
      { minCommittedInfluence: 60, dice: 3 },
    ],
  },
  defender: {
    maxDice: 2,
    bands: [
      { minCommittedInfluence: 10, dice: 1 },
      { minCommittedInfluence: 40, dice: 2 },
    ],
  },
};
