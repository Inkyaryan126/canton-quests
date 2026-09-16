import type {
  GridContestConfig,
  GridContestRoundInput,
  GridContestRoundResult,
  GridContestSideConfig,
} from './contest-types';

export function signalDiceForCommit(
  committedInfluence: number,
  side: GridContestSideConfig,
): number {
  if (!Number.isFinite(committedInfluence) || committedInfluence <= 0) return 0;

  const eligible = [...side.bands]
    .sort((a, b) => a.minCommittedInfluence - b.minCommittedInfluence)
    .filter((band) => committedInfluence >= band.minCommittedInfluence);

  const configured = eligible.at(-1)?.dice ?? 0;
  return Math.max(0, Math.min(side.maxDice, configured));
}

function validateRolls(
  rolls: number[],
  allowedDice: number,
  dieSides: number,
  label: string,
): void {
  if (rolls.length > allowedDice) {
    throw new Error(`${label} supplied ${rolls.length} rolls but only ${allowedDice} dice are allowed`);
  }

  for (const roll of rolls) {
    if (!Number.isInteger(roll) || roll < 1 || roll > dieSides) {
      throw new Error(`${label} roll ${roll} is outside 1..${dieSides}`);
    }
  }
}

export function resolveSignalDiceRound(
  input: GridContestRoundInput,
  config: GridContestConfig,
): GridContestRoundResult {
  const attackerDice = signalDiceForCommit(input.attackerCommittedInfluence, config.attacker);
  const defenderDice = signalDiceForCommit(input.defenderCommittedInfluence, config.defender);

  validateRolls(input.attackerRolls, attackerDice, config.dieSides, 'attacker');
  validateRolls(input.defenderRolls, defenderDice, config.dieSides, 'defender');

  const attacker = [...input.attackerRolls].sort((a, b) => b - a);
  const defender = [...input.defenderRolls].sort((a, b) => b - a);
  const comparisons = [];

  let attackerInfluenceLost = 0;
  let defenderInfluenceLost = 0;

  for (let index = 0; index < Math.min(attacker.length, defender.length); index += 1) {
    const attackerRoll = attacker[index];
    const defenderRoll = defender[index];
    const attackerWins =
      attackerRoll > defenderRoll ||
      (attackerRoll === defenderRoll && !config.tiesFavorDefender);

    const winner = attackerWins ? 'attacker' : 'defender';
    comparisons.push({ attackerRoll, defenderRoll, winner } as const);

    if (attackerWins) defenderInfluenceLost += config.influenceLossPerComparison;
    else attackerInfluenceLost += config.influenceLossPerComparison;
  }

  attackerInfluenceLost = Math.min(attackerInfluenceLost, input.attackerCommittedInfluence);
  defenderInfluenceLost = Math.min(defenderInfluenceLost, input.defenderCommittedInfluence);

  return {
    comparisons,
    attackerInfluenceLost,
    defenderInfluenceLost,
    attackerRemainingInfluence: input.attackerCommittedInfluence - attackerInfluenceLost,
    defenderRemainingInfluence: input.defenderCommittedInfluence - defenderInfluenceLost,
  };
}
