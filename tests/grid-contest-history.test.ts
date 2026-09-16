import { describe, expect, it, vi } from 'vitest';
import type {
  GridContestHistoryContext,
  GridContestHistoryEvent,
  GridContestHistoryPort,
} from '../lib/grid/server/contest-history-port';
import { getGridContestHistory } from '../lib/grid/server/contest-history-service';

const contest: GridContestHistoryContext = {
  contestId: 'contest-1',
  seasonId: 'season-1',
  cityId: 'city-1',
  sourceTerritoryId: 'source-1',
  targetTerritoryId: 'target-1',
  attackerPlayerId: 'attacker-1',
  defenderPlayerId: 'defender-1',
  attackerCommittedInfluence: 60,
  defenderCommittedInfluence: 40,
  attackerRemainingInfluence: 50,
  defenderRemainingInfluence: 20,
  roundNumber: 2,
  status: 'active',
  startedAt: '2026-09-16T06:00:00.000Z',
  endedAt: null,
};

const events: GridContestHistoryEvent[] = [
  {
    eventId: 'event-3',
    actorPlayerId: 'attacker-1',
    eventType: 'grid:contest_session_round_resolved',
    payload: { roundNumber: 2 },
    createdAt: '2026-09-16T06:02:00.000Z',
  },
  {
    eventId: 'event-1',
    actorPlayerId: 'attacker-1',
    eventType: 'grid:contest_started',
    payload: { defenderPlayerId: 'defender-1' },
    createdAt: '2026-09-16T06:00:00.000Z',
  },
  {
    eventId: 'event-2',
    actorPlayerId: 'attacker-1',
    eventType: 'grid:contest_session_round_resolved',
    payload: { roundNumber: 1 },
    createdAt: '2026-09-16T06:01:00.000Z',
  },
];

function makePort(
  context: GridContestHistoryContext | null = contest,
): GridContestHistoryPort {
  return {
    getContestContext: vi.fn().mockResolvedValue(context),
    listContestEvents: vi.fn().mockResolvedValue(events),
  };
}

describe('Grid contest replay history', () => {
  it('returns a deterministic ordered replay to the attacker', async () => {
    const port = makePort();

    await expect(
      getGridContestHistory(port, {
        contestId: contest.contestId,
        viewerPlayerId: contest.attackerPlayerId,
      }),
    ).resolves.toEqual({
      contest,
      viewerRole: 'attacker',
      events: [events[1], events[2], events[0]],
    });

    expect(port.listContestEvents).toHaveBeenCalledWith(
      contest.contestId,
      contest.seasonId,
    );
  });

  it('lets the defender inspect the same authoritative replay', async () => {
    const port = makePort();
    const result = await getGridContestHistory(port, {
      contestId: contest.contestId,
      viewerPlayerId: contest.defenderPlayerId,
    });

    expect(result.viewerRole).toBe('defender');
    expect(result.events).toHaveLength(3);
  });

  it('does not reveal a contest replay to an unrelated player', async () => {
    const port = makePort();

    await expect(
      getGridContestHistory(port, {
        contestId: contest.contestId,
        viewerPlayerId: 'outsider-1',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(port.listContestEvents).not.toHaveBeenCalled();
  });

  it('reports a missing contest without querying its event ledger', async () => {
    const port = makePort(null);

    await expect(
      getGridContestHistory(port, {
        contestId: 'missing',
        viewerPlayerId: contest.attackerPlayerId,
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(port.listContestEvents).not.toHaveBeenCalled();
  });

  it('rejects malformed replay requests before touching persistence', async () => {
    const port = makePort();

    await expect(
      getGridContestHistory(port, {
        contestId: ' ',
        viewerPlayerId: contest.attackerPlayerId,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });

    expect(port.getContestContext).not.toHaveBeenCalled();
  });
});
