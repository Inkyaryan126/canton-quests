import type {
  GridCreateScrimmageCommand,
  GridEndScrimmageCommand,
  GridJoinScrimmageCommand,
  GridLeaveScrimmageCommand,
  GridScrimmageParticipant,
  GridScrimmageRules,
  GridScrimmageState,
  GridSetScrimmageReadyCommand,
  GridStartScrimmageCommand,
} from './scrimmage-types';

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Grid scrimmage requires ${label}`);
  }
  return normalized;
}

function requireTimestamp(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`Grid scrimmage requires a valid ${label} timestamp`);
  }
  return value;
}

function normalizeInviteCode(value: string): string {
  const normalized = requireNonEmpty(value, 'inviteCode').toUpperCase();
  if (!/^[A-Z0-9-]{4,24}$/.test(normalized)) {
    throw new Error(
      'Grid scrimmage inviteCode must be 4-24 letters, numbers, or hyphens',
    );
  }
  return normalized;
}

function validateRules(rules: GridScrimmageRules): GridScrimmageRules {
  if (
    !Number.isInteger(rules.minPlayers) ||
    !Number.isInteger(rules.maxPlayers) ||
    rules.minPlayers < 2 ||
    rules.maxPlayers < rules.minPlayers
  ) {
    throw new Error(
      'Grid scrimmage rules require integer player limits with 2 <= minPlayers <= maxPlayers',
    );
  }

  if (rules.maxPlayers > 12) {
    throw new Error('Grid scrimmage maxPlayers cannot exceed 12');
  }

  return { ...rules };
}

function cloneParticipants(
  participants: GridScrimmageParticipant[],
): GridScrimmageParticipant[] {
  return participants.map((participant) => ({ ...participant }));
}

function updateState(
  state: GridScrimmageState,
  patch: Partial<GridScrimmageState>,
): GridScrimmageState {
  return {
    ...state,
    ...patch,
    participants:
      patch.participants !== undefined
        ? cloneParticipants(patch.participants)
        : cloneParticipants(state.participants),
    rules: { ...state.rules },
    revision: state.revision + 1,
  };
}

function participantIndex(
  state: GridScrimmageState,
  playerId: string,
): number {
  return state.participants.findIndex(
    (participant) => participant.playerId === playerId,
  );
}

function requireLobby(state: GridScrimmageState): void {
  if (state.status !== 'lobby') {
    throw new Error('Grid scrimmage action requires a lobby session');
  }
}

function requireHost(state: GridScrimmageState, playerId: string): void {
  if (state.hostPlayerId !== playerId) {
    throw new Error('Grid scrimmage action requires the session host');
  }
}

export function createGridScrimmage(
  command: GridCreateScrimmageCommand,
): GridScrimmageState {
  const sessionId = requireNonEmpty(command.sessionId, 'sessionId');
  const cityId = requireNonEmpty(command.cityId, 'cityId');
  const hostPlayerId = requireNonEmpty(
    command.hostPlayerId,
    'hostPlayerId',
  );
  const createdAt = requireTimestamp(command.now, 'now');
  const inviteCode = normalizeInviteCode(command.inviteCode);
  const rules = validateRules(command.rules);

  return {
    sessionId,
    cityId,
    hostPlayerId,
    inviteCode,
    status: 'lobby',
    progressionScope: 'session-only',
    participants: [
      {
        playerId: hostPlayerId,
        joinedAt: createdAt,
        ready: false,
      },
    ],
    rules,
    revision: 0,
    createdAt,
    startedAt: null,
    endedAt: null,
  };
}

export function joinGridScrimmage(
  state: GridScrimmageState,
  command: GridJoinScrimmageCommand,
): GridScrimmageState {
  requireLobby(state);
  const playerId = requireNonEmpty(command.playerId, 'playerId');
  const joinedAt = requireTimestamp(command.now, 'now');
  const inviteCode = normalizeInviteCode(command.inviteCode);

  if (inviteCode !== state.inviteCode) {
    throw new Error('Grid scrimmage invite code is invalid');
  }

  if (participantIndex(state, playerId) >= 0) {
    return {
      ...state,
      participants: cloneParticipants(state.participants),
      rules: { ...state.rules },
    };
  }

  if (state.participants.length >= state.rules.maxPlayers) {
    throw new Error('Grid scrimmage lobby is full');
  }

  return updateState(state, {
    participants: [
      ...state.participants,
      {
        playerId,
        joinedAt,
        ready: false,
      },
    ],
  });
}

export function setGridScrimmageReady(
  state: GridScrimmageState,
  command: GridSetScrimmageReadyCommand,
): GridScrimmageState {
  requireLobby(state);
  const playerId = requireNonEmpty(command.playerId, 'playerId');
  const index = participantIndex(state, playerId);

  if (index < 0) {
    throw new Error('Grid scrimmage player is not in the lobby');
  }

  if (state.participants[index].ready === command.ready) {
    return {
      ...state,
      participants: cloneParticipants(state.participants),
      rules: { ...state.rules },
    };
  }

  const participants = cloneParticipants(state.participants);
  participants[index] = {
    ...participants[index],
    ready: command.ready,
  };

  return updateState(state, { participants });
}

export function leaveGridScrimmage(
  state: GridScrimmageState,
  command: GridLeaveScrimmageCommand,
): GridScrimmageState {
  requireLobby(state);
  const playerId = requireNonEmpty(command.playerId, 'playerId');
  const index = participantIndex(state, playerId);

  if (index < 0) {
    return {
      ...state,
      participants: cloneParticipants(state.participants),
      rules: { ...state.rules },
    };
  }

  if (playerId === state.hostPlayerId) {
    throw new Error(
      'Grid scrimmage host must cancel instead of leaving the lobby',
    );
  }

  return updateState(state, {
    participants: state.participants.filter(
      (participant) => participant.playerId !== playerId,
    ),
  });
}

export function startGridScrimmage(
  state: GridScrimmageState,
  command: GridStartScrimmageCommand,
): GridScrimmageState {
  requireLobby(state);
  const playerId = requireNonEmpty(command.playerId, 'playerId');
  const startedAt = requireTimestamp(command.now, 'now');
  requireHost(state, playerId);

  if (state.participants.length < state.rules.minPlayers) {
    throw new Error('Grid scrimmage does not have enough players to start');
  }

  if (
    state.rules.requireAllReady &&
    state.participants.some((participant) => !participant.ready)
  ) {
    throw new Error('Grid scrimmage cannot start until every player is ready');
  }

  return updateState(state, {
    status: 'active',
    startedAt,
  });
}

export function completeGridScrimmage(
  state: GridScrimmageState,
  command: GridEndScrimmageCommand,
): GridScrimmageState {
  const playerId = requireNonEmpty(command.playerId, 'playerId');
  const endedAt = requireTimestamp(command.now, 'now');
  requireHost(state, playerId);

  if (state.status !== 'active') {
    throw new Error('Grid scrimmage completion requires an active session');
  }

  return updateState(state, {
    status: 'completed',
    endedAt,
  });
}

export function cancelGridScrimmage(
  state: GridScrimmageState,
  command: GridEndScrimmageCommand,
): GridScrimmageState {
  const playerId = requireNonEmpty(command.playerId, 'playerId');
  const endedAt = requireTimestamp(command.now, 'now');
  requireHost(state, playerId);

  if (state.status !== 'lobby' && state.status !== 'active') {
    throw new Error('Grid scrimmage is already ended');
  }

  return updateState(state, {
    status: 'cancelled',
    endedAt,
  });
}
