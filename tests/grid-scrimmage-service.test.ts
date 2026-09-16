import { describe, expect, it } from 'vitest';
import type { GridScrimmageState } from '../lib/grid/core/scrimmage-types';
import type {
  GridScrimmageCreateResult,
  GridScrimmagePort,
  GridScrimmageUpdateResult,
} from '../lib/grid/server/scrimmage-port';
import {
  cancelGridScrimmageSession,
  createGridScrimmageSession,
  getGridScrimmageSessionForPlayer,
  joinGridScrimmageSession,
  setGridScrimmageSessionReady,
  startGridScrimmageSession,
} from '../lib/grid/server/scrimmage-service';

class MemoryScrimmagePort implements GridScrimmagePort {
  byId = new Map<string, GridScrimmageState>();
  inviteToId = new Map<string, string>();
  forceConflict = false;

  async create(
    state: GridScrimmageState,
  ): Promise<GridScrimmageCreateResult> {
    if (
      this.byId.has(state.sessionId) ||
      this.inviteToId.has(state.inviteCode)
    ) {
      return { created: false, state: null };
    }

    this.byId.set(state.sessionId, structuredClone(state));
    this.inviteToId.set(state.inviteCode, state.sessionId);
    return { created: true, state: structuredClone(state) };
  }

  async getById(sessionId: string) {
    const state = this.byId.get(sessionId);
    return state ? structuredClone(state) : null;
  }

  async getByInviteCode(inviteCode: string) {
    const sessionId = this.inviteToId.get(inviteCode);
    return sessionId ? this.getById(sessionId) : null;
  }

  async compareAndSwap(
    sessionId: string,
    expectedRevision: number,
    nextState: GridScrimmageState,
  ): Promise<GridScrimmageUpdateResult> {
    const current = this.byId.get(sessionId);
    if (
      this.forceConflict ||
      !current ||
      current.revision !== expectedRevision
    ) {
      return {
        updated: false,
        state: current ? structuredClone(current) : null,
      };
    }

    this.byId.set(sessionId, structuredClone(nextState));
    return { updated: true, state: structuredClone(nextState) };
  }
}

const createCommand = {
  sessionId: 'scrim-1',
  cityId: 'canton-oh',
  hostPlayerId: 'host-1',
  inviteCode: 'crew-26',
  rules: {
    minPlayers: 2,
    maxPlayers: 4,
    requireAllReady: true,
  },
  now: '2026-09-16T10:00:00.000Z',
} as const;

describe('GRID scrimmage server service', () => {
  it('persists a normalized private lobby and prevents duplicate creation', async () => {
    const port = new MemoryScrimmagePort();
    const created = await createGridScrimmageSession(port, createCommand);

    expect(created.inviteCode).toBe('CREW-26');
    expect(created.progressionScope).toBe('session-only');

    await expect(
      createGridScrimmageSession(port, createCommand),
    ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
  });

  it('joins by normalized invite code and persists with optimistic revisioning', async () => {
    const port = new MemoryScrimmagePort();
    await createGridScrimmageSession(port, createCommand);

    const joined = await joinGridScrimmageSession(port, {
      playerId: 'guest-1',
      inviteCode: ' crew-26 ',
      now: '2026-09-16T10:01:00.000Z',
    });

    expect(joined.revision).toBe(1);
    expect(joined.participants.map((p) => p.playerId)).toEqual([
      'host-1',
      'guest-1',
    ]);
    expect((await port.getById('scrim-1'))?.revision).toBe(1);
  });

  it('does not write again for an idempotent repeated join', async () => {
    const port = new MemoryScrimmagePort();
    await createGridScrimmageSession(port, createCommand);
    const joined = await joinGridScrimmageSession(port, {
      playerId: 'guest-1',
      inviteCode: 'CREW-26',
      now: '2026-09-16T10:01:00.000Z',
    });

    port.forceConflict = true;
    const repeated = await joinGridScrimmageSession(port, {
      playerId: 'guest-1',
      inviteCode: 'CREW-26',
      now: '2026-09-16T10:02:00.000Z',
    });

    expect(repeated).toEqual(joined);
  });

  it('surfaces optimistic concurrency conflicts instead of overwriting newer state', async () => {
    const port = new MemoryScrimmagePort();
    await createGridScrimmageSession(port, createCommand);
    port.forceConflict = true;

    await expect(
      setGridScrimmageSessionReady(port, 'scrim-1', {
        playerId: 'host-1',
        ready: true,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect((await port.getById('scrim-1'))?.revision).toBe(0);
  });

  it('persists ready state and a host-started session without touching permanent progression', async () => {
    const port = new MemoryScrimmagePort();
    await createGridScrimmageSession(port, createCommand);
    await joinGridScrimmageSession(port, {
      playerId: 'guest-1',
      inviteCode: 'CREW-26',
      now: '2026-09-16T10:01:00.000Z',
    });
    await setGridScrimmageSessionReady(port, 'scrim-1', {
      playerId: 'host-1',
      ready: true,
    });
    await setGridScrimmageSessionReady(port, 'scrim-1', {
      playerId: 'guest-1',
      ready: true,
    });

    const active = await startGridScrimmageSession(
      port,
      'scrim-1',
      {
        playerId: 'host-1',
        now: '2026-09-16T10:02:00.000Z',
      },
    );

    expect(active.status).toBe('active');
    expect(active.progressionScope).toBe('session-only');
    expect(active.revision).toBe(4);
  });

  it('only returns session state to players already in the private lobby', async () => {
    const port = new MemoryScrimmagePort();
    await createGridScrimmageSession(port, createCommand);

    await expect(
      getGridScrimmageSessionForPlayer(port, 'scrim-1', 'host-1'),
    ).resolves.toMatchObject({ sessionId: 'scrim-1' });

    await expect(
      getGridScrimmageSessionForPlayer(port, 'scrim-1', 'outsider-1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns not-found for missing invite codes or session ids', async () => {
    const port = new MemoryScrimmagePort();

    await expect(
      joinGridScrimmageSession(port, {
        playerId: 'guest-1',
        inviteCode: 'NONE-1',
        now: createCommand.now,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      cancelGridScrimmageSession(port, 'missing', {
        playerId: 'host-1',
        now: createCommand.now,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
