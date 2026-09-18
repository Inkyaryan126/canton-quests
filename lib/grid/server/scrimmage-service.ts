import { signalDiceForCommit } from '../core/contest';
import type { GridContestConfig } from '../core/contest-types';
import {
  cancelGridScrimmage,
  completeGridScrimmage,
  createGridScrimmage,
  joinGridScrimmage,
  leaveGridScrimmage,
  normalizeGridScrimmageInviteCode,
  resolveGridScrimmageDuel,
  setGridScrimmageReady,
  startGridScrimmage,
} from '../core/scrimmage';
import type {
  GridCreateScrimmageCommand,
  GridEndScrimmageCommand,
  GridJoinScrimmageCommand,
  GridLeaveScrimmageCommand,
  GridScrimmageState,
  GridSetScrimmageReadyCommand,
  GridStartScrimmageCommand,
} from '../core/scrimmage-types';
import type { GridScrimmagePort } from './scrimmage-port';

export type GridScrimmageDiceRoller = (dieSides: number) => number;

export interface GridScrimmageDuelSessionCommand {
  attackerPlayerId: string;
  defenderPlayerId: string;
  now: string;
}

export type GridScrimmageServiceErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ALREADY_EXISTS';

export class GridScrimmageServiceError extends Error {
  constructor(
    public readonly code: GridScrimmageServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GridScrimmageServiceError';
  }
}

async function loadById(
  port: GridScrimmagePort,
  sessionId: string,
): Promise<GridScrimmageState> {
  const state = await port.getById(sessionId);
  if (!state) {
    throw new GridScrimmageServiceError(
      'NOT_FOUND',
      'Grid scrimmage session was not found',
    );
  }
  return state;
}

async function persistMutation(
  port: GridScrimmagePort,
  current: GridScrimmageState,
  next: GridScrimmageState,
): Promise<GridScrimmageState> {
  if (next.revision === current.revision) {
    return next;
  }

  if (next.revision !== current.revision + 1) {
    throw new GridScrimmageServiceError(
      'CONFLICT',
      'Grid scrimmage revision advanced unexpectedly',
    );
  }

  const result = await port.compareAndSwap(
    current.sessionId,
    current.revision,
    next,
  );

  if (!result.updated || !result.state) {
    throw new GridScrimmageServiceError(
      'CONFLICT',
      'Grid scrimmage changed; reload before retrying',
    );
  }

  return result.state;
}

export async function getGridScrimmageSessionForPlayer(
  port: GridScrimmagePort,
  sessionId: string,
  playerId: string,
): Promise<GridScrimmageState> {
  const current = await loadById(port, sessionId);
  if (
    !current.participants.some(
      (participant) => participant.playerId === playerId,
    )
  ) {
    throw new GridScrimmageServiceError(
      'NOT_FOUND',
      'Grid scrimmage session was not found',
    );
  }
  return current;
}

export async function createGridScrimmageSession(
  port: GridScrimmagePort,
  command: GridCreateScrimmageCommand,
): Promise<GridScrimmageState> {
  const state = createGridScrimmage(command);
  const result = await port.create(state);

  if (!result.created || !result.state) {
    throw new GridScrimmageServiceError(
      'ALREADY_EXISTS',
      'Grid scrimmage session or invite code already exists',
    );
  }

  return result.state;
}

export async function joinGridScrimmageSession(
  port: GridScrimmagePort,
  command: GridJoinScrimmageCommand,
): Promise<GridScrimmageState> {
  const inviteCode = normalizeGridScrimmageInviteCode(
    command.inviteCode,
  );
  const current = await port.getByInviteCode(inviteCode);

  if (!current) {
    throw new GridScrimmageServiceError(
      'NOT_FOUND',
      'Grid scrimmage session was not found',
    );
  }

  return persistMutation(
    port,
    current,
    joinGridScrimmage(current, {
      ...command,
      inviteCode,
    }),
  );
}

export async function setGridScrimmageSessionReady(
  port: GridScrimmagePort,
  sessionId: string,
  command: GridSetScrimmageReadyCommand,
): Promise<GridScrimmageState> {
  const current = await loadById(port, sessionId);
  return persistMutation(
    port,
    current,
    setGridScrimmageReady(current, command),
  );
}

export async function leaveGridScrimmageSession(
  port: GridScrimmagePort,
  sessionId: string,
  command: GridLeaveScrimmageCommand,
): Promise<GridScrimmageState> {
  const current = await loadById(port, sessionId);
  return persistMutation(
    port,
    current,
    leaveGridScrimmage(current, command),
  );
}

export async function startGridScrimmageSession(
  port: GridScrimmagePort,
  sessionId: string,
  command: GridStartScrimmageCommand,
): Promise<GridScrimmageState> {
  const current = await loadById(port, sessionId);
  return persistMutation(
    port,
    current,
    startGridScrimmage(current, command),
  );
}

export async function resolveGridScrimmageDuelSession(
  port: GridScrimmagePort,
  sessionId: string,
  command: GridScrimmageDuelSessionCommand,
  config: GridContestConfig,
  rollDie: GridScrimmageDiceRoller,
): Promise<GridScrimmageState> {
  const current = await loadById(port, sessionId);
  const match = current.match;
  if (!match) {
    throw new Error('Grid scrimmage duel requires an active match');
  }

  const attacker = match.combatants.find(
    (combatant) => combatant.playerId === command.attackerPlayerId,
  );
  const defender = match.combatants.find(
    (combatant) => combatant.playerId === command.defenderPlayerId,
  );

  const attackerDice = attacker
    ? signalDiceForCommit(attacker.remainingInfluence, config.attacker)
    : 0;
  const defenderDice = defender
    ? signalDiceForCommit(defender.remainingInfluence, config.defender)
    : 0;

  const attackerRolls = Array.from(
    { length: attackerDice },
    () => rollDie(config.dieSides),
  );
  const defenderRolls = Array.from(
    { length: defenderDice },
    () => rollDie(config.dieSides),
  );

  return persistMutation(
    port,
    current,
    resolveGridScrimmageDuel(
      current,
      {
        attackerPlayerId: command.attackerPlayerId,
        defenderPlayerId: command.defenderPlayerId,
        attackerRolls,
        defenderRolls,
        now: command.now,
      },
      config,
    ),
  );
}

export async function completeGridScrimmageSession(
  port: GridScrimmagePort,
  sessionId: string,
  command: GridEndScrimmageCommand,
): Promise<GridScrimmageState> {
  const current = await loadById(port, sessionId);
  return persistMutation(
    port,
    current,
    completeGridScrimmage(current, command),
  );
}

export async function cancelGridScrimmageSession(
  port: GridScrimmagePort,
  sessionId: string,
  command: GridEndScrimmageCommand,
): Promise<GridScrimmageState> {
  const current = await loadById(port, sessionId);
  return persistMutation(
    port,
    current,
    cancelGridScrimmage(current, command),
  );
}
