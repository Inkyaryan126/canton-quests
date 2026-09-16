import { describe, expect, it } from 'vitest';
import type {
  GridActiveContest,
  GridActiveContestPort,
} from '../lib/grid/server/active-contest-port';
import { listGridActiveContests } from '../lib/grid/server/active-contest-service';

const ids = {
  season: '11111111-1111-4111-8111-111111111111',
  city: '22222222-2222-4222-8222-222222222222',
  source: '33333333-3333-4333-8333-333333333333',
  target: '44444444-4444-4444-8444-444444444444',
  attacker: '55555555-5555-4555-8555-555555555555',
  defender: '66666666-6666-4666-8666-666666666666',
  contestA: '77777777-7777-4777-8777-777777777777',
  contestB: '88888888-8888-4888-8888-888888888888',
  contestC: '99999999-9999-4999-8999-999999999999',
};

const baseContest: GridActiveContest = {
  contestId: ids.contestA,
  seasonId: ids.season,
  cityId: ids.city,
  sourceTerritoryId: ids.source,
  targetTerritoryId: ids.target,
  attackerPlayerId: ids.attacker,
  defenderPlayerId: ids.defender,
  attackerRemainingInfluence: 4,
  defenderRemainingInfluence: 3,
  roundNumber: 2,
  startedAt: '2026-09-16T08:00:00.000Z',
};

function portWith(rows: GridActiveContest[]): GridActiveContestPort {
  return { listActiveContests: async () => rows };
}

describe('listGridActiveContests', () => {
  it('requires a season id', async () => {
    await expect(
      listGridActiveContests(portWith([]), { seasonId: '   ' }),
    ).rejects.toThrow('Grid active contest discovery requires seasonId');
  });

  it('returns newest contests first with stable contest-id ties', async () => {
    const rows = [
      { ...baseContest, contestId: ids.contestB },
      { ...baseContest, contestId: ids.contestC, startedAt: '2026-09-16T09:00:00.000Z' },
      { ...baseContest, contestId: ids.contestA },
    ];

    const result = await listGridActiveContests(portWith(rows), {
      seasonId: ids.season,
    });

    expect(result.map((contest) => contest.contestId)).toEqual([
      ids.contestC,
      ids.contestA,
      ids.contestB,
    ]);
  });

  it('rejects malformed UUID filters before touching persistence', async () => {
    const port = portWith([]);

    await expect(
      listGridActiveContests(port, {
        seasonId: ids.season,
        playerId: 'not-a-uuid',
      }),
    ).rejects.toThrow('Grid active contest discovery requires valid playerId');
  });

  it('passes optional player and territory filters to the port', async () => {
    let received: unknown;
    const port: GridActiveContestPort = {
      listActiveContests: async (query) => {
        received = query;
        return [];
      },
    };

    await listGridActiveContests(port, {
      seasonId: ids.season,
      playerId: ids.attacker,
      territoryId: ids.target,
    });

    expect(received).toEqual({
      seasonId: ids.season,
      playerId: ids.attacker,
      territoryId: ids.target,
    });
  });
});
