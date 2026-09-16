import {
  resolveSignalDiceRound,
  signalDiceForCommit,
} from './contest';
import type { GridContestConfig } from './contest-types';
import type {
  GridTutorialContestAction,
  GridTutorialContestConfig,
  GridTutorialContestState,
} from './tutorial-contest-types';

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

function validateTutorialConfig(config: GridTutorialContestConfig): void {
  requirePositiveSafeInteger(
    config.attackerInitialCommitInfluence,
    'attackerInitialCommitInfluence',
  );
  requireNonNegativeSafeInteger(
    config.attackerReserveInfluence,
    'attackerReserveInfluence',
  );
  requirePositiveSafeInteger(
    config.reinforcementInfluence,
    'reinforcementInfluence',
  );
  requirePositiveSafeInteger(
    config.defenderCommittedInfluence,
    'defenderCommittedInfluence',
  );

  if (config.reinforcementInfluence > config.attackerReserveInfluence) {
    throw new Error(
      'reinforcementInfluence cannot exceed attackerReserveInfluence',
    );
  }

  const reinforced =
    config.attackerInitialCommitInfluence + config.reinforcementInfluence;
  if (!Number.isSafeInteger(reinforced)) {
    throw new Error('reinforced attacker Influence exceeds safe integer range');
  }
}

export function createGridTutorialContest(
  config: GridTutorialContestConfig,
): GridTutorialContestState {
  validateTutorialConfig(config);

  return {
    phase: 'reinforce',
    safeMode: true,
    liveResourceDelta: 0,
    attackerCommittedInfluence: config.attackerInitialCommitInfluence,
    attackerReserveInfluence: config.attackerReserveInfluence,
    defenderCommittedInfluence: config.defenderCommittedInfluence,
    lessons: {
      reinforce: false,
      contest: false,
      continue: false,
      withdraw: false,
    },
    rounds: [],
  };
}

function requirePhase(
  state: GridTutorialContestState,
  expected: GridTutorialContestState['phase'],
  action: GridTutorialContestAction['type'],
): void {
  if (state.phase !== expected) {
    throw new Error(
      `tutorial contest cannot ${action} during ${state.phase} phase`,
    );
  }
}
function reinforce(
  state: GridTutorialContestState,
  config: GridTutorialContestConfig,
): GridTutorialContestState {
  requirePhase(state, 'reinforce', 'reinforce');
  validateTutorialConfig(config);

  const attackerCommittedInfluence =
    state.attackerCommittedInfluence + config.reinforcementInfluence;
  if (!Number.isSafeInteger(attackerCommittedInfluence)) {
    throw new Error('reinforced attacker Influence exceeds safe integer range');
  }
  if (state.attackerReserveInfluence < config.reinforcementInfluence) {
    throw new Error('tutorial contest has insufficient simulated reserve');
  }

  return {
    ...state,
    phase: 'contest',
    attackerCommittedInfluence,
    attackerReserveInfluence:
      state.attackerReserveInfluence - config.reinforcementInfluence,
    lessons: { ...state.lessons, reinforce: true },
  };
}
function resolveRound(
  state: GridTutorialContestState,
  action: Extract<
    GridTutorialContestAction,
    { type: 'contest' | 'continue' }
  >,
  contestConfig: GridContestConfig,
): GridTutorialContestState {
  const expected = action.type === 'contest' ? 'contest' : 'continue';
  requirePhase(state, expected, action.type);

  const attackerDice = signalDiceForCommit(
    state.attackerCommittedInfluence,
    contestConfig.attacker,
  );
  const defenderDice = signalDiceForCommit(
    state.defenderCommittedInfluence,
    contestConfig.defender,
  );
  if (attackerDice === 0 || defenderDice === 0) {
    throw new Error(
      'tutorial contest requires both sides to have enough Influence to roll',
    );
  }

  const result = resolveSignalDiceRound(
    {
      attackerCommittedInfluence: state.attackerCommittedInfluence,
      defenderCommittedInfluence: state.defenderCommittedInfluence,
      attackerRolls: action.attackerRolls,
      defenderRolls: action.defenderRolls,
    },
    contestConfig,
  );

  return {
    ...state,
    phase: action.type === 'contest' ? 'continue' : 'withdraw',
    attackerCommittedInfluence: result.attackerRemainingInfluence,
    defenderCommittedInfluence: result.defenderRemainingInfluence,
    lessons: {
      ...state.lessons,
      [action.type]: true,
    },
    rounds: [
      ...state.rounds,
      {
        roundNumber: state.rounds.length + 1,
        result,
      },
    ],
  };
}
function withdraw(
  state: GridTutorialContestState,
): GridTutorialContestState {
  requirePhase(state, 'withdraw', 'withdraw');
  return {
    ...state,
    phase: 'complete',
    lessons: { ...state.lessons, withdraw: true },
  };
}

export function applyGridTutorialContestAction(
  state: GridTutorialContestState,
  action: GridTutorialContestAction,
  tutorialConfig: GridTutorialContestConfig,
  contestConfig: GridContestConfig,
): GridTutorialContestState {
  if (state.phase === 'complete') {
    throw new Error('tutorial contest is already complete');
  }

  switch (action.type) {
    case 'reinforce':
      return reinforce(state, tutorialConfig);
    case 'contest':
    case 'continue':
      return resolveRound(state, action, contestConfig);
    case 'withdraw':
      return withdraw(state);
  }
}
export function gridTutorialContestComplete(
  state: GridTutorialContestState,
): boolean {
  return (
    state.phase === 'complete' &&
    Object.values(state.lessons).every(Boolean) &&
    state.safeMode &&
    state.liveResourceDelta === 0
  );
}
