import { describe, expect, it } from 'vitest';
import {
  cancelGridScrimmage,
  completeGridScrimmage,
  createGridScrimmage,
  joinGridScrimmage,
  leaveGridScrimmage,
  resetGridScrimmageForRematch,
  setGridScrimmageReady,
  startGridScrimmage,
} from '../lib/grid/core/scrimmage';

const NOW = '2026-09-16T10:00:00.000Z';

function createLobby(
  overrides: Partial<Parameters<typeof createGridScrimmage>[0]> = {},
) {
  return createGridScrimmage({
    sessionId: 'scrim-1',
    cityId: 'canton-oh',
    hostPlayerId: 'host-1',
    inviteCode: 'fight-01',
    rules: {
      minPlayers: 2,
      maxPlayers: 4,
      requireAllReady: true,
    },
    now: NOW,
    ...overrides,
  });
}

describe('GRID scrimmage core', () => {
  it('creates an isolated session-only lobby with the host already joined', () => {
    const state = createLobby();

    expect(state).toMatchObject({
      sessionId: 'scrim-1',
      cityId: 'canton-oh',
      hostPlayerId: 'host-1',
      inviteCode: 'FIGHT-01',
      status: 'lobby',
      progressionScope: 'session-only',
      revision: 0,
      startedAt: null,
      endedAt: null,
    });
    expect(state.participants).toEqual([
      {
        playerId: 'host-1',
        joinedAt: NOW,
        ready: false,
      },
    ]);
  });

  it('normalizes invite codes and lets a guest join without mutating the old state', () => {
    const state = createLobby();
    const joined = joinGridScrimmage(state, {
      playerId: 'guest-1',
      inviteCode: ' fight-01 ',
      now: '2026-09-16T10:01:00.000Z',
    });

    expect(state.participants).toHaveLength(1);
    expect(joined.participants).toHaveLength(2);
    expect(joined.participants[1]).toEqual({
      playerId: 'guest-1',
      joinedAt: '2026-09-16T10:01:00.000Z',
      ready: false,
    });
    expect(joined.revision).toBe(1);
  });

  it('makes repeated joins idempotent for a player already in the lobby', () => {
    const joined = joinGridScrimmage(createLobby(), {
      playerId: 'guest-1',
      inviteCode: 'FIGHT-01',
      now: '2026-09-16T10:01:00.000Z',
    });
    const repeated = joinGridScrimmage(joined, {
      playerId: 'guest-1',
      inviteCode: 'FIGHT-01',
      now: '2026-09-16T10:02:00.000Z',
    });

    expect(repeated).toEqual(joined);
    expect(repeated.revision).toBe(1);
  });

  it('rejects wrong invite codes and full lobbies', () => {
    const state = createLobby({
      rules: {
        minPlayers: 2,
        maxPlayers: 2,
        requireAllReady: false,
      },
    });

    expect(() =>
      joinGridScrimmage(state, {
        playerId: 'guest-1',
        inviteCode: 'WRONG-1',
        now: NOW,
      }),
    ).toThrow('Grid scrimmage invite code is invalid');

    const full = joinGridScrimmage(state, {
      playerId: 'guest-1',
      inviteCode: 'FIGHT-01',
      now: NOW,
    });

    expect(() =>
      joinGridScrimmage(full, {
        playerId: 'guest-2',
        inviteCode: 'FIGHT-01',
        now: NOW,
      }),
    ).toThrow('Grid scrimmage lobby is full');
  });

  it('tracks ready state and blocks start until the configured lobby is ready', () => {
    let state = joinGridScrimmage(createLobby(), {
      playerId: 'guest-1',
      inviteCode: 'FIGHT-01',
      now: NOW,
    });

    expect(() =>
      startGridScrimmage(state, {
        playerId: 'host-1',
        now: '2026-09-16T10:02:00.000Z',
      }),
    ).toThrow('Grid scrimmage cannot start until every player is ready');

    state = setGridScrimmageReady(state, {
      playerId: 'host-1',
      ready: true,
    });
    state = setGridScrimmageReady(state, {
      playerId: 'guest-1',
      ready: true,
    });

    const active = startGridScrimmage(state, {
      playerId: 'host-1',
      now: '2026-09-16T10:02:00.000Z',
    });

    expect(active.status).toBe('active');
    expect(active.startedAt).toBe('2026-09-16T10:02:00.000Z');
  });

  it('only lets the host start, complete, or cancel the session', () => {
    let state = joinGridScrimmage(createLobby({
      rules: {
        minPlayers: 2,
        maxPlayers: 4,
        requireAllReady: false,
      },
    }), {
      playerId: 'guest-1',
      inviteCode: 'FIGHT-01',
      now: NOW,
    });

    expect(() =>
      startGridScrimmage(state, {
        playerId: 'guest-1',
        now: NOW,
      }),
    ).toThrow('Grid scrimmage action requires the session host');

    state = startGridScrimmage(state, {
      playerId: 'host-1',
      now: NOW,
    });

    expect(() =>
      completeGridScrimmage(state, {
        playerId: 'guest-1',
        now: NOW,
      }),
    ).toThrow('Grid scrimmage action requires the session host');
  });

  it('allows non-host players to leave only while the session is still a lobby', () => {
    let state = joinGridScrimmage(createLobby(), {
      playerId: 'guest-1',
      inviteCode: 'FIGHT-01',
      now: NOW,
    });

    const left = leaveGridScrimmage(state, {
      playerId: 'guest-1',
    });
    expect(left.participants.map((player) => player.playerId)).toEqual([
      'host-1',
    ]);

    expect(() =>
      leaveGridScrimmage(state, {
        playerId: 'host-1',
      }),
    ).toThrow(
      'Grid scrimmage host must cancel instead of leaving the lobby',
    );

    state = setGridScrimmageReady(state, {
      playerId: 'host-1',
      ready: true,
    });
    state = setGridScrimmageReady(state, {
      playerId: 'guest-1',
      ready: true,
    });
    const active = startGridScrimmage(state, {
      playerId: 'host-1',
      now: NOW,
    });

    expect(() =>
      leaveGridScrimmage(active, {
        playerId: 'guest-1',
      }),
    ).toThrow('Grid scrimmage action requires a lobby session');
  });

  it('completes an active session without changing its session-only progression scope', () => {
    let state = joinGridScrimmage(createLobby({
      rules: {
        minPlayers: 2,
        maxPlayers: 4,
        requireAllReady: false,
      },
    }), {
      playerId: 'guest-1',
      inviteCode: 'FIGHT-01',
      now: NOW,
    });
    state = startGridScrimmage(state, {
      playerId: 'host-1',
      now: '2026-09-16T10:02:00.000Z',
    });

    const completed = completeGridScrimmage(state, {
      playerId: 'host-1',
      now: '2026-09-16T10:20:00.000Z',
    });

    expect(completed).toMatchObject({
      status: 'completed',
      progressionScope: 'session-only',
      endedAt: '2026-09-16T10:20:00.000Z',
    });
  });

  it('lets the host cancel either a lobby or an active scrimmage', () => {
    const lobby = createLobby();
    const cancelledLobby = cancelGridScrimmage(lobby, {
      playerId: 'host-1',
      now: '2026-09-16T10:05:00.000Z',
    });

    expect(cancelledLobby.status).toBe('cancelled');

    let active = joinGridScrimmage(createLobby({
      rules: {
        minPlayers: 2,
        maxPlayers: 4,
        requireAllReady: false,
      },
    }), {
      playerId: 'guest-1',
      inviteCode: 'FIGHT-01',
      now: NOW,
    });
    active = startGridScrimmage(active, {
      playerId: 'host-1',
      now: NOW,
    });

    expect(
      cancelGridScrimmage(active, {
        playerId: 'host-1',
        now: '2026-09-16T10:10:00.000Z',
      }).status,
    ).toBe('cancelled');
  });

  it('lets only the host reopen a completed room for a clean rematch', () => {
    let state = joinGridScrimmage(createLobby({
      rules: {
        minPlayers: 2,
        maxPlayers: 4,
        requireAllReady: false,
      },
    }), {
      playerId: 'guest-1',
      inviteCode: 'FIGHT-01',
      now: NOW,
    });
    state = startGridScrimmage(state, {
      playerId: 'host-1',
      now: '2026-09-16T10:02:00.000Z',
    });
    const completed = completeGridScrimmage(state, {
      playerId: 'host-1',
      now: '2026-09-16T10:20:00.000Z',
    });

    expect(() =>
      resetGridScrimmageForRematch(completed, {
        playerId: 'guest-1',
      }),
    ).toThrow('Grid scrimmage action requires the session host');

    const rematch = resetGridScrimmageForRematch(completed, {
      playerId: 'host-1',
    });

    expect(rematch.status).toBe('lobby');
    expect(rematch.match).toBeNull();
    expect(rematch.startedAt).toBeNull();
    expect(rematch.endedAt).toBeNull();
    expect(rematch.revision).toBe(completed.revision + 1);
    expect(rematch.participants.every((participant) => !participant.ready)).toBe(
      true,
    );
    expect(rematch.inviteCode).toBe(completed.inviteCode);
  });

  it('rejects invalid player limits, timestamps, and unsafe invite codes', () => {
    expect(() =>
      createLobby({
        rules: {
          minPlayers: 1,
          maxPlayers: 4,
          requireAllReady: true,
        },
      }),
    ).toThrow('2 <= minPlayers <= maxPlayers');

    expect(() =>
      createLobby({
        rules: {
          minPlayers: 2,
          maxPlayers: 13,
          requireAllReady: true,
        },
      }),
    ).toThrow('maxPlayers cannot exceed 12');

    expect(() =>
      createLobby({
        inviteCode: 'bad code!',
      }),
    ).toThrow('inviteCode must be 4-24 letters, numbers, or hyphens');

    expect(() =>
      createLobby({
        now: 'not-a-time',
      }),
    ).toThrow('valid now timestamp');
  });
});
