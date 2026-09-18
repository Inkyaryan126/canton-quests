import { describe, expect, it, vi } from 'vitest';
import type {
  GridPveStrongholdHistoryEvent,
  GridPveStrongholdHistoryPort,
} from '../lib/grid/server/pve-stronghold-history-port';
import {
  getGridPveStrongholdHistory,
} from '../lib/grid/server/pve-stronghold-history-service';

const context = {
  contestId: 'contest-1',
  seasonId: 'season-1',
  attackerPlayerId: 'player-1',
};
const events: GridPveStrongholdHistoryEvent[] = [
  {
    eventId: 'event-2',
    eventType: 'grid:pve_stronghold_round_resolved',
    createdAt: '2026-09-18T07:01:00.000Z',
    payload: {
      strongholdId: 'fort-1', roundNumber: 1, status: 'active',
      attackerRolls: [6, 4], garrisonRolls: [5, 3],
      comparisons: [
        { attackerRoll: 6, defenderRoll: 5, winner: 'attacker' },
        { attackerRoll: 4, defenderRoll: 3, winner: 'attacker' },
      ],
      attackerInfluenceLost: 0, garrisonInfluenceLost: 20,
      attackerRemainingInfluence: 60, garrisonRemainingInfluence: 40,
      attackerRefundedInfluence: 0, territoryCaptured: false,
      targetTerritoryId: 'internal-target-id', secretFutureField: 'do-not-leak',
    },
  },
  {
    eventId: 'event-1',
    eventType: 'grid:pve_stronghold_contest_started',
    createdAt: '2026-09-18T07:00:00.000Z',
    payload: {
      strongholdId: 'fort-1', factionId: 'wardens',
      sourceTerritoryId: 'internal-source-id', targetTerritoryId: 'internal-target-id',
      objectiveKind: 'pve-landmark', landmarkSlug: 'tower',
      attackerCommittedInfluence: 60, garrisonCommittedInfluence: 60,
    },
  },
  {
    eventId: 'event-3',
    eventType: 'grid:pve_stronghold_contest_withdrawn',
    createdAt: '2026-09-18T07:02:00.000Z',
    payload: {
      strongholdId: 'fort-1', attackerRefundedInfluence: 60,
      garrisonRemainingInfluence: 40, targetTerritoryId: 'internal-target-id',
    },
  },
];

function port(
  contest = context,
  eventRows: GridPveStrongholdHistoryEvent[] = events,
): GridPveStrongholdHistoryPort {
  return {
    getContestContext: vi.fn().mockResolvedValue(contest),
    listContestEvents: vi.fn().mockResolvedValue(eventRows),
  };
}

describe('Grid PvE stronghold battle history', () => {
  it('returns a deterministic sanitized timeline to the attacker', async () => {
    const result = await getGridPveStrongholdHistory(port(), {
      contestId: 'contest-1', viewerPlayerId: 'player-1',
    });
    expect(result.events).toEqual([
      {
        kind: 'started', strongholdId: 'fort-1', factionId: 'wardens',
        objectiveKind: 'pve-landmark', landmarkSlug: 'tower',
        attackerCommittedInfluence: 60, garrisonCommittedInfluence: 60,
        createdAt: '2026-09-18T07:00:00.000Z',
      },
      {
        kind: 'round', strongholdId: 'fort-1', roundNumber: 1, status: 'active',
        attackerRolls: [6, 4], garrisonRolls: [5, 3],
        comparisons: [
          { attackerRoll: 6, garrisonRoll: 5, winner: 'attacker' },
          { attackerRoll: 4, garrisonRoll: 3, winner: 'attacker' },
        ],
        attackerInfluenceLost: 0, garrisonInfluenceLost: 20,
        attackerRemainingInfluence: 60, garrisonRemainingInfluence: 40,
        attackerRefundedInfluence: 0, territoryCaptured: false,
        createdAt: '2026-09-18T07:01:00.000Z',
      },
      {
        kind: 'withdrawn', strongholdId: 'fort-1', attackerRefundedInfluence: 60,
        garrisonRemainingInfluence: 40, createdAt: '2026-09-18T07:02:00.000Z',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('internal-target-id');
    expect(JSON.stringify(result)).not.toContain('secretFutureField');
    expect(JSON.stringify(result)).not.toContain('event-1');
  });

  it('uses the same not-found surface for missing and another player contest', async () => {
    for (const p of [
      port(null as unknown as typeof context),
      port({ ...context, attackerPlayerId: 'player-2' }),
    ]) {
      await expect(getGridPveStrongholdHistory(p, {
        contestId: 'contest-1', viewerPlayerId: 'player-1',
      })).rejects.toMatchObject({
        code: 'NOT_FOUND', message: 'Grid PvE stronghold history was not found',
      });
      expect(p.listContestEvents).not.toHaveBeenCalled();
    }
  });

  it('fails closed on malformed authoritative payloads', async () => {
    const broken = [{
      ...events[1],
      payload: { ...events[1].payload, attackerCommittedInfluence: 'sixty' },
    }];
    await expect(getGridPveStrongholdHistory(port(context, broken), {
      contestId: 'contest-1', viewerPlayerId: 'player-1',
    })).rejects.toThrow('ledger event is malformed: attackerCommittedInfluence');
  });

  it('validates request identity before persistence reads', async () => {
    const p = port();
    await expect(getGridPveStrongholdHistory(p, {
      contestId: ' ', viewerPlayerId: 'player-1',
    })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(p.getContestContext).not.toHaveBeenCalled();
  });
});
