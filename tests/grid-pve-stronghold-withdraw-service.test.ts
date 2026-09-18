import { describe, expect, it, vi } from 'vitest';
import type { GridPveStrongholdSessionPort } from '../lib/grid/server/pve-stronghold-session-port';
import { withdrawGridPveStrongholdSession } from '../lib/grid/server/pve-stronghold-session-service';

const now = '2026-09-18T07:40:00.000Z';
function port(): GridPveStrongholdSessionPort {
  return {
    getStartContext: vi.fn(),
    startContest: vi.fn(),
    getRoundContext: vi.fn(),
    resolveRound: vi.fn(),
    withdrawContest: vi.fn().mockResolvedValue({
      contestId: 'contest-1',
      seasonId: 'season-1',
      cityId: 'city-1',
      strongholdId: 'fort-1',
      status: 'withdrawn',
      attackerRefundedInfluence: 40,
      endedAt: now,
      eventId: 'event-1',
    }),
  };
}

describe('Grid PvE stronghold withdrawal service', () => {
  it('validates and forwards attacker withdrawal commands', async () => {
    const p = port();
    await expect(withdrawGridPveStrongholdSession(p, {
      contestId: 'contest-1',
      attackerPlayerId: 'player-1',
      idempotencyKey: 'withdraw-1',
      now,
    })).resolves.toMatchObject({ status: 'withdrawn', attackerRefundedInfluence: 40 });
    expect(p.withdrawContest).toHaveBeenCalledWith({
      contestId: 'contest-1',
      attackerPlayerId: 'player-1',
      idempotencyKey: 'withdraw-1',
      now,
    });
  });

  it('rejects blank identity/idempotency and invalid timestamps before persistence', async () => {
    const p = port();
    await expect(withdrawGridPveStrongholdSession(p, {
      contestId: ' ', attackerPlayerId: 'player-1', idempotencyKey: 'key', now,
    })).rejects.toThrow('contestId');
    await expect(withdrawGridPveStrongholdSession(p, {
      contestId: 'contest-1', attackerPlayerId: ' ', idempotencyKey: 'key', now,
    })).rejects.toThrow('attackerPlayerId');
    await expect(withdrawGridPveStrongholdSession(p, {
      contestId: 'contest-1', attackerPlayerId: 'player-1', idempotencyKey: ' ', now,
    })).rejects.toThrow('idempotency key');
    await expect(withdrawGridPveStrongholdSession(p, {
      contestId: 'contest-1', attackerPlayerId: 'player-1', idempotencyKey: 'key', now: 'bad',
    })).rejects.toThrow('valid now timestamp');
    expect(p.withdrawContest).not.toHaveBeenCalled();
  });
});
