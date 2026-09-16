import { resolveSignalDiceRound, signalDiceForCommit } from '../core/contest';
import type { GridContestConfig } from '../core/contest-types';
import { createSeededRng } from './rng';

export interface GridContestRoundSimulationOptions {
  seed: number;
  iterations: number;
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
}

export interface GridContestRoundSimulationReport {
  seed: number;
  iterations: number;
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  attackerDice: number;
  defenderDice: number;
  totalComparisons: number;
  comparisonWins: {
    attacker: number;
    defender: number;
  };
  comparisonWinRate: {
    attacker: number;
    defender: number;
  };
  roundAdvantage: {
    attacker: number;
    defender: number;
    even: number;
  };
  roundAdvantageRate: {
    attacker: number;
    defender: number;
    even: number;
  };
  averageInfluenceLost: {
    attacker: number;
    defender: number;
  };
  averageRemainingInfluence: {
    attacker: number;
    defender: number;
  };
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function rollSignalDice(
  count: number,
  dieSides: number,
  rng: () => number,
): number[] {
  return Array.from(
    { length: count },
    () => Math.floor(rng() * dieSides) + 1,
  );
}

function ratio(value: number, total: number): number {
  if (total === 0) return 0;
  return Number((value / total).toFixed(6));
}

function average(value: number, total: number): number {
  if (total === 0) return 0;
  return Number((value / total).toFixed(4));
}

export function runContestRoundSimulation(
  config: GridContestConfig,
  options: GridContestRoundSimulationOptions,
): GridContestRoundSimulationReport {
  assertPositiveInteger(options.iterations, 'contest simulation iterations');
  assertPositiveInteger(
    options.attackerCommittedInfluence,
    'attacker committed Influence',
  );
  assertPositiveInteger(
    options.defenderCommittedInfluence,
    'defender committed Influence',
  );

  const attackerDice = signalDiceForCommit(
    options.attackerCommittedInfluence,
    config.attacker,
  );
  const defenderDice = signalDiceForCommit(
    options.defenderCommittedInfluence,
    config.defender,
  );
  const rng = createSeededRng(options.seed);

  let totalComparisons = 0;
  let attackerComparisonWins = 0;
  let defenderComparisonWins = 0;
  let attackerRoundAdvantage = 0;
  let defenderRoundAdvantage = 0;
  let evenRounds = 0;
  let attackerInfluenceLost = 0;
  let defenderInfluenceLost = 0;

  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const result = resolveSignalDiceRound(
      {
        attackerCommittedInfluence: options.attackerCommittedInfluence,
        defenderCommittedInfluence: options.defenderCommittedInfluence,
        attackerRolls: rollSignalDice(attackerDice, config.dieSides, rng),
        defenderRolls: rollSignalDice(defenderDice, config.dieSides, rng),
      },
      config,
    );

    totalComparisons += result.comparisons.length;
    attackerInfluenceLost += result.attackerInfluenceLost;
    defenderInfluenceLost += result.defenderInfluenceLost;

    for (const comparison of result.comparisons) {
      if (comparison.winner === 'attacker') attackerComparisonWins += 1;
      else defenderComparisonWins += 1;
    }

    if (result.defenderInfluenceLost > result.attackerInfluenceLost) {
      attackerRoundAdvantage += 1;
    } else if (result.attackerInfluenceLost > result.defenderInfluenceLost) {
      defenderRoundAdvantage += 1;
    } else {
      evenRounds += 1;
    }
  }

  return {
    seed: options.seed,
    iterations: options.iterations,
    attackerCommittedInfluence: options.attackerCommittedInfluence,
    defenderCommittedInfluence: options.defenderCommittedInfluence,
    attackerDice,
    defenderDice,
    totalComparisons,
    comparisonWins: {
      attacker: attackerComparisonWins,
      defender: defenderComparisonWins,
    },
    comparisonWinRate: {
      attacker: ratio(attackerComparisonWins, totalComparisons),
      defender: ratio(defenderComparisonWins, totalComparisons),
    },
    roundAdvantage: {
      attacker: attackerRoundAdvantage,
      defender: defenderRoundAdvantage,
      even: evenRounds,
    },
    roundAdvantageRate: {
      attacker: ratio(attackerRoundAdvantage, options.iterations),
      defender: ratio(defenderRoundAdvantage, options.iterations),
      even: ratio(evenRounds, options.iterations),
    },
    averageInfluenceLost: {
      attacker: average(attackerInfluenceLost, options.iterations),
      defender: average(defenderInfluenceLost, options.iterations),
    },
    averageRemainingInfluence: {
      attacker: average(
        options.attackerCommittedInfluence * options.iterations -
          attackerInfluenceLost,
        options.iterations,
      ),
      defender: average(
        options.defenderCommittedInfluence * options.iterations -
          defenderInfluenceLost,
        options.iterations,
      ),
    },
  };
}
