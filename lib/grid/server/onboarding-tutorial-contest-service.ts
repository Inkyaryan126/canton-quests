import {
  resolveSignalDiceRound,
  signalDiceForCommit,
} from '../core/contest';
import type {
  GridContestConfig,
  GridContestComparison,
} from '../core/contest-types';
import type { GridCityPackage } from '../core/types';
import { appendGridEvent } from './event-ledger';
import type { GridEventLedgerPort } from './event-ledger-port';
import { readGridOnboardingStatus } from './onboarding-status-service';
import type { GridOnboardingStatusPort } from './onboarding-status-port';
import type {
  GridOnboardingTutorialContestPort,
} from './onboarding-tutorial-contest-port';
import type { GridSignalDiceRoller } from './contest-service';

export interface GridOnboardingTutorialContestRequest {
  playerId: string;
  idempotencyKey: string;
  now: string;
}

export interface GridOnboardingTutorialContestResult {
  completed: true;
  alreadyComplete: boolean;
  attackerCommittedInfluence: number;
  defenderCommittedInfluence: number;
  attackerRolls: number[];
  defenderRolls: number[];
  comparisons: GridContestComparison[];
  attackerInfluenceLost: number;
  defenderInfluenceLost: number;
  tiesFavorDefender: true;
}
function requireRequest(request: GridOnboardingTutorialContestRequest): void {
  if (!request.playerId.trim()) {
    throw new Error('Grid onboarding tutorial contest requires playerId');
  }
  if (!request.idempotencyKey.trim()) {
    throw new Error(
      'Grid onboarding tutorial contest requires a non-empty idempotency key',
    );
  }
  if (!Number.isFinite(Date.parse(request.now))) {
    throw new Error(
      'Grid onboarding tutorial contest requires a valid now timestamp',
    );
  }
}

function tutorialCommit(
  config: GridContestConfig,
  side: 'attacker' | 'defender',
  desiredDice: number,
): number {
  const bands = [...config[side].bands].sort(
    (a, b) => a.minCommittedInfluence - b.minCommittedInfluence,
  );
  const chosen =
    bands.find((band) => band.dice >= desiredDice) ??
    bands.at(-1);
  if (!chosen || chosen.dice <= 0) {
    throw new Error('Grid onboarding tutorial contest has no usable dice band');
  }
  return chosen.minCommittedInfluence;
}

function rollMany(
  roller: GridSignalDiceRoller,
  count: number,
  dieSides: number,
): number[] {
  return Array.from({ length: count }, () => {
    const value = roller.roll(dieSides);
    if (!Number.isInteger(value) || value < 1 || value > dieSides) {
      throw new Error(
        `Grid onboarding tutorial roller returned invalid d${dieSides} result: ${value}`,
      );
    }
    return value;
  });
}
function resultFromPayload(
  payload: Record<string, unknown>,
  alreadyComplete: boolean,
): GridOnboardingTutorialContestResult {
  const attackerRolls = Array.isArray(payload.attackerRolls)
    ? payload.attackerRolls.filter((value): value is number => Number.isInteger(value))
    : [];
  const defenderRolls = Array.isArray(payload.defenderRolls)
    ? payload.defenderRolls.filter((value): value is number => Number.isInteger(value))
    : [];
  const comparisons = Array.isArray(payload.comparisons)
    ? payload.comparisons.filter(
        (value): value is GridContestComparison =>
          Boolean(
            value &&
              typeof value === 'object' &&
              Number.isInteger((value as GridContestComparison).attackerRoll) &&
              Number.isInteger((value as GridContestComparison).defenderRoll) &&
              ['attacker', 'defender'].includes(
                (value as GridContestComparison).winner,
              ),
          ),
      )
    : [];

  return {
    completed: true,
    alreadyComplete,
    attackerCommittedInfluence:
      typeof payload.attackerCommittedInfluence === 'number'
        ? payload.attackerCommittedInfluence
        : 0,
    defenderCommittedInfluence:
      typeof payload.defenderCommittedInfluence === 'number'
        ? payload.defenderCommittedInfluence
        : 0,
    attackerRolls,
    defenderRolls,
    comparisons,
    attackerInfluenceLost:
      typeof payload.attackerInfluenceLost === 'number'
        ? payload.attackerInfluenceLost
        : 0,
    defenderInfluenceLost:
      typeof payload.defenderInfluenceLost === 'number'
        ? payload.defenderInfluenceLost
        : 0,
    tiesFavorDefender: true,
  };
}
export async function completeGridOnboardingTutorialContest(
  contextPort: GridOnboardingTutorialContestPort,
  statusPort: GridOnboardingStatusPort,
  eventPort: GridEventLedgerPort,
  roller: GridSignalDiceRoller,
  pkg: GridCityPackage,
  request: GridOnboardingTutorialContestRequest,
): Promise<GridOnboardingTutorialContestResult> {
  requireRequest(request);

  const config = pkg.seasonTemplate.contest;
  if (!config) {
    throw new Error('Grid onboarding tutorial contest requires contest config');
  }

  const context = await contextPort.getContext(request.playerId);
  if (
    !context ||
    !['active', 'surge'].includes(context.seasonStatus)
  ) {
    throw new Error('Grid onboarding tutorial contest requires an active season');
  }

  const existing = await eventPort.getByIdempotencyKey(
    context.seasonId,
    request.idempotencyKey,
  );
  if (existing) {
    if (
      existing.eventType !== 'grid:tutorial_contest_completed' ||
      existing.actorPlayerId !== request.playerId
    ) {
      throw new Error(
        'Grid onboarding tutorial contest idempotency key belongs to another command',
      );
    }
    return resultFromPayload(existing.payload, true);
  }

  const status = await readGridOnboardingStatus(statusPort, request.playerId);
  if (status.steps.some(
    (step) => step.id === 'complete-tutorial-contest' && step.complete,
  )) {
    return {
      completed: true,
      alreadyComplete: true,
      attackerCommittedInfluence: 0,
      defenderCommittedInfluence: 0,
      attackerRolls: [],
      defenderRolls: [],
      comparisons: [],
      attackerInfluenceLost: 0,
      defenderInfluenceLost: 0,
      tiesFavorDefender: true,
    };
  }
  if (status.nextStep?.id !== 'complete-tutorial-contest') {
    throw new Error(
      'Grid onboarding tutorial contest is not the current onboarding step',
    );
  }

  const attackerCommittedInfluence = tutorialCommit(
    config,
    'attacker',
    Math.min(2, config.attacker.maxDice),
  );
  const defenderCommittedInfluence = tutorialCommit(config, 'defender', 1);
  const attackerDice = signalDiceForCommit(
    attackerCommittedInfluence,
    config.attacker,
  );
  const defenderDice = signalDiceForCommit(
    defenderCommittedInfluence,
    config.defender,
  );

  const attackerRolls = rollMany(roller, attackerDice, config.dieSides);
  const defenderRolls = rollMany(roller, defenderDice, config.dieSides);
  const round = resolveSignalDiceRound(
    {
      attackerCommittedInfluence,
      defenderCommittedInfluence,
      attackerRolls,
      defenderRolls,
    },
    config,
  );

  const event = await appendGridEvent(eventPort, {
    cityId: context.cityId,
    seasonId: context.seasonId,
    actorPlayerId: request.playerId,
    eventType: 'grid:tutorial_contest_completed',
    entityType: 'tutorial',
    payload: {
      tutorialVersion: 1,
      attackerCommittedInfluence,
      defenderCommittedInfluence,
      attackerRolls,
      defenderRolls,
      comparisons: round.comparisons.map((comparison) => ({
        attackerRoll: comparison.attackerRoll,
        defenderRoll: comparison.defenderRoll,
        winner: comparison.winner,
      })),
      attackerInfluenceLost: round.attackerInfluenceLost,
      defenderInfluenceLost: round.defenderInfluenceLost,
      tiesFavorDefender: true,
      safePractice: true,
      walletMutation: false,
      territoryMutation: false,
    },
    idempotencyKey: request.idempotencyKey,
  });

  return resultFromPayload(event.payload, false);
}
