import { resolveSignalDiceRound, signalDiceForCommit } from './contest';
import type { GridContestConfig } from './contest-types';
import type {
  GridPveStrongholdContestState,
  GridPveStrongholdRoundResult,
  GridResolvePveStrongholdRoundInput,
  GridStartPveStrongholdContestInput,
} from './pve-stronghold-contest-types';

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} cannot be blank`);
}

function validateState(state: GridPveStrongholdContestState): void {
  requireNonBlank(state.strongholdId, 'PvE stronghold id');
  requireNonBlank(state.factionId, 'PvE faction id');
  requirePositiveSafeInteger(state.roundNumber, 'PvE roundNumber');
  requirePositiveSafeInteger(
    state.attackerInitialInfluence,
    'PvE attackerInitialInfluence',
  );
  requirePositiveSafeInteger(
    state.garrisonInitialInfluence,
    'PvE garrisonInitialInfluence',
  );
  requireNonNegativeSafeInteger(
    state.attackerRemainingInfluence,
    'PvE attackerRemainingInfluence',
  );
  requireNonNegativeSafeInteger(
    state.garrisonRemainingInfluence,
    'PvE garrisonRemainingInfluence',
  );
  if (state.attackerRemainingInfluence > state.attackerInitialInfluence) {
    throw new Error('PvE attackerRemainingInfluence cannot exceed initial Influence');
  }
  if (state.garrisonRemainingInfluence > state.garrisonInitialInfluence) {
    throw new Error('PvE garrisonRemainingInfluence cannot exceed initial garrison');
  }

  if (state.status === 'active') {
    if (
      state.attackerRemainingInfluence === 0 ||
      state.garrisonRemainingInfluence === 0
    ) {
      throw new Error('Active PvE stronghold contests require both sides to have Influence');
    }
  } else if (state.status === 'captured') {
    if (state.attackerRemainingInfluence === 0) {
      throw new Error('Captured PvE stronghold state requires surviving attacker Influence');
    }
  }
}

export function startGridPveStrongholdContest(
  input: GridStartPveStrongholdContestInput,
): GridPveStrongholdContestState {
  const { stronghold } = input;
  requirePositiveSafeInteger(
    input.attackerCommittedInfluence,
    'PvE attackerCommittedInfluence',
  );
  requireNonBlank(stronghold.strongholdId, 'PvE stronghold id');
  requireNonBlank(stronghold.objective.factionId, 'PvE faction id');

  if (stronghold.status !== 'active' || !stronghold.contestable) {
    throw new Error('PvE stronghold must be active and contestable');
  }
  requirePositiveSafeInteger(
    stronghold.garrisonInfluence,
    'PvE stronghold garrisonInfluence',
  );

  return {
    strongholdId: stronghold.strongholdId,
    factionId: stronghold.objective.factionId,
    objective: { ...stronghold.objective },
    status: 'active',
    roundNumber: 1,
    attackerInitialInfluence: input.attackerCommittedInfluence,
    attackerRemainingInfluence: input.attackerCommittedInfluence,
    garrisonInitialInfluence: stronghold.garrisonInfluence,
    garrisonRemainingInfluence: stronghold.garrisonInfluence,
  };
}

export function resolveGridPveStrongholdRound(
  input: GridResolvePveStrongholdRoundInput,
  contestConfig: GridContestConfig,
): GridPveStrongholdRoundResult {
  validateState(input.state);
  if (input.state.status !== 'active') {
    throw new Error('PvE stronghold contest is already resolved');
  }
  if (
    signalDiceForCommit(input.state.attackerRemainingInfluence, contestConfig.attacker) <= 0
  ) {
    throw new Error('PvE stronghold attacker cannot continue');
  }
  if (
    signalDiceForCommit(input.state.garrisonRemainingInfluence, contestConfig.defender) <= 0
  ) {
    throw new Error('PvE stronghold garrison cannot continue');
  }

  const resolved = resolveSignalDiceRound(
    {
      attackerCommittedInfluence: input.state.attackerRemainingInfluence,
      defenderCommittedInfluence: input.state.garrisonRemainingInfluence,
      attackerRolls: input.attackerRolls,
      defenderRolls: input.garrisonRolls,
    },
    contestConfig,
  );

  const attackerRemainingInfluence = resolved.attackerRemainingInfluence;
  const garrisonRemainingInfluence = resolved.defenderRemainingInfluence;
  const attackerCanContinue =
    attackerRemainingInfluence > 0 &&
    signalDiceForCommit(attackerRemainingInfluence, contestConfig.attacker) > 0;
  const garrisonCanContinue =
    garrisonRemainingInfluence > 0 &&
    signalDiceForCommit(garrisonRemainingInfluence, contestConfig.defender) > 0;
  const status = !attackerCanContinue
    ? 'repelled'
    : !garrisonCanContinue
      ? 'captured'
      : 'active';

  const state: GridPveStrongholdContestState = {
    ...input.state,
    status,
    roundNumber: input.state.roundNumber + 1,
    attackerRemainingInfluence,
    garrisonRemainingInfluence,
  };
  validateState(state);

  return {
    state,
    comparisons: resolved.comparisons,
    attackerInfluenceLost: resolved.attackerInfluenceLost,
    garrisonInfluenceLost: resolved.defenderInfluenceLost,
  };
}
