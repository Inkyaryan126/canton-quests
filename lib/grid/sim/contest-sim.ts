import type { GridContestConfig } from '../core/contest-types';
import { resolveSignalDiceRound, signalDiceForCommit } from '../core/contest';
import { createSeededRng } from './rng';

export interface GridContestBalanceSimulationOptions {
  seed: number;
  roundsPerMatchup: number;
  attackerCommitments: number[];
  defenderCommitments: number[];
}

export interface GridContestBalanceMatchup {
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  attackerDice: number;
  defenderDice: number;
  rounds: number;
  comparisons: number;
  tiedComparisons: number;
  attackerComparisonWins: number;
  defenderComparisonWins: number;
  attackerRoundAdvantages: number;
  defenderRoundAdvantages: number;
  splitRounds: number;
  averageAttackerInfluenceLost: number;
  averageDefenderInfluenceLost: number;
}

export interface GridContestBalanceSimulationReport {
  seed: number;
  roundsPerMatchup: number;
  matchups: GridContestBalanceMatchup[];
  totals: {
    rounds: number;
    comparisons: number;
    tiedComparisons: number;
    attackerComparisonWins: number;
    defenderComparisonWins: number;
  };
  invariantViolations: string[];
}

function validateCommitments(values: number[], label: string): void {
  if (values.length === 0) {
    throw new Error(`contest simulation ${label} commitments cannot be empty`);
  }
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error(
      `contest simulation ${label} commitments must be finite non-negative numbers`,
    );
  }
}

function rollDice(count: number, dieSides: number, rng: () => number): number[] {
  return Array.from(
    { length: count },
    () => Math.floor(rng() * dieSides) + 1,
  );
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function simulateMatchup(
  config: GridContestConfig,
  attackerCommittedInfluence: number,
  defenderCommittedInfluence: number,
  rounds: number,
  rng: () => number,
  invariantViolations: string[],
): GridContestBalanceMatchup {
  const attackerDice = signalDiceForCommit(
    attackerCommittedInfluence,
    config.attacker,
  );
  const defenderDice = signalDiceForCommit(
    defenderCommittedInfluence,
    config.defender,
  );

  let comparisons = 0;
  let tiedComparisons = 0;
  let attackerComparisonWins = 0;
  let defenderComparisonWins = 0;
  let attackerRoundAdvantages = 0;
  let defenderRoundAdvantages = 0;
  let splitRounds = 0;
  let attackerInfluenceLost = 0;
  let defenderInfluenceLost = 0;

  for (let round = 0; round < rounds; round += 1) {
    const result = resolveSignalDiceRound(
      {
        attackerCommittedInfluence,
        defenderCommittedInfluence,
        attackerRolls: rollDice(attackerDice, config.dieSides, rng),
        defenderRolls: rollDice(defenderDice, config.dieSides, rng),
      },
      config,
    );

    comparisons += result.comparisons.length;
    attackerInfluenceLost += result.attackerInfluenceLost;
    defenderInfluenceLost += result.defenderInfluenceLost;

    for (const comparison of result.comparisons) {
      if (comparison.attackerRoll === comparison.defenderRoll) {
        tiedComparisons += 1;
        if (comparison.winner !== 'defender') {
          invariantViolations.push('tie did not favor defender');
        }
      }

      if (comparison.winner === 'attacker') attackerComparisonWins += 1;
      else defenderComparisonWins += 1;
    }

    if (result.attackerInfluenceLost < result.defenderInfluenceLost) {
      attackerRoundAdvantages += 1;
    } else if (result.defenderInfluenceLost < result.attackerInfluenceLost) {
      defenderRoundAdvantages += 1;
    } else {
      splitRounds += 1;
    }

    if (
      result.attackerRemainingInfluence < 0 ||
      result.defenderRemainingInfluence < 0
    ) {
      invariantViolations.push('contest round produced negative remaining Influence');
    }

    const maxComparisons = Math.min(attackerDice, defenderDice);
    if (result.comparisons.length > maxComparisons) {
      invariantViolations.push('contest round exceeded allowed comparison count');
    }
  }

  return {
    attackerCommittedInfluence,
    defenderCommittedInfluence,
    attackerDice,
    defenderDice,
    rounds,
    comparisons,
    tiedComparisons,
    attackerComparisonWins,
    defenderComparisonWins,
    attackerRoundAdvantages,
    defenderRoundAdvantages,
    splitRounds,
    averageAttackerInfluenceLost: round2(attackerInfluenceLost / rounds),
    averageDefenderInfluenceLost: round2(defenderInfluenceLost / rounds),
  };
}

export function runContestBalanceSimulation(
  config: GridContestConfig,
  options: GridContestBalanceSimulationOptions,
): GridContestBalanceSimulationReport {
  if (!Number.isInteger(options.roundsPerMatchup) || options.roundsPerMatchup < 1) {
    throw new Error('contest simulation roundsPerMatchup must be a positive integer');
  }

  validateCommitments(options.attackerCommitments, 'attacker');
  validateCommitments(options.defenderCommitments, 'defender');

  const rng = createSeededRng(options.seed);
  const invariantViolations: string[] = [];
  const matchups: GridContestBalanceMatchup[] = [];

  for (const attackerCommittedInfluence of options.attackerCommitments) {
    for (const defenderCommittedInfluence of options.defenderCommitments) {
      matchups.push(
        simulateMatchup(
          config,
          attackerCommittedInfluence,
          defenderCommittedInfluence,
          options.roundsPerMatchup,
          rng,
          invariantViolations,
        ),
      );
    }
  }

  const totals = matchups.reduce(
    (sum, matchup) => ({
      rounds: sum.rounds + matchup.rounds,
      comparisons: sum.comparisons + matchup.comparisons,
      tiedComparisons: sum.tiedComparisons + matchup.tiedComparisons,
      attackerComparisonWins:
        sum.attackerComparisonWins + matchup.attackerComparisonWins,
      defenderComparisonWins:
        sum.defenderComparisonWins + matchup.defenderComparisonWins,
    }),
    {
      rounds: 0,
      comparisons: 0,
      tiedComparisons: 0,
      attackerComparisonWins: 0,
      defenderComparisonWins: 0,
    },
  );

  return {
    seed: options.seed,
    roundsPerMatchup: options.roundsPerMatchup,
    matchups,
    totals,
    invariantViolations,
  };
}
