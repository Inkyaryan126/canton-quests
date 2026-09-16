export type GridContestTactic = 'pressure' | 'flank' | 'fortify' | 'feint';

export interface GridSignalDiceBand {
  minCommittedInfluence: number;
  dice: number;
}

export interface GridContestSideConfig {
  maxDice: number;
  bands: GridSignalDiceBand[];
}

export interface GridContestConfig {
  dieSides: number;
  influenceLossPerComparison: number;
  tiesFavorDefender: true;
  attacker: GridContestSideConfig;
  defender: GridContestSideConfig;
}

export interface GridContestRoundInput {
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  attackerRolls: number[];
  defenderRolls: number[];
}

export interface GridContestComparison {
  attackerRoll: number;
  defenderRoll: number;
  winner: 'attacker' | 'defender';
}

export interface GridContestRoundResult {
  comparisons: GridContestComparison[];
  attackerInfluenceLost: number;
  defenderInfluenceLost: number;
  attackerRemainingInfluence: number;
  defenderRemainingInfluence: number;
}
