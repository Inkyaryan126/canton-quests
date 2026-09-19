import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isGridContractRewardSettlementEnabled } from '../lib/grid/server/contract-reward-settlement-feature-flags';

const route = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/admin/grid/contracts/rewards/settle/route.ts',
  ),
  'utf8',
);

describe('Grid Contract reward settlement admin API contract', () => {
  it('requires admin auth and an explicit settlement kill switch', () => {
    const auth = route.indexOf('resolveAdminSessionFromRequest(request)');
    const settle = route.indexOf('settlePendingGridContractRewards(');
    expect(auth).toBeGreaterThanOrEqual(0);
    expect(settle).toBeGreaterThan(auth);
    expect(route).toContain('isGridContractRewardSettlementEnabled()');
    expect(
      isGridContractRewardSettlementEnabled({
        NODE_ENV: 'test',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isGridContractRewardSettlementEnabled({
        NODE_ENV: 'test',
        GRID_CONTRACT_REWARD_SETTLEMENT_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('accepts only an optional bounded batch size from the caller', () => {
    expect(route).toContain('body.limit');
    for (const forbidden of [
      'body.reward',
      'body.playerId',
      'body.seasonId',
      'body.credits',
      'body.influence',
      'body.commandPoints',
      'body.outboxId',
    ]) {
      expect(route).not.toContain(forbidden);
    }
  });

  it('derives command time on the server and hides settlement player details', () => {
    expect(route).toContain('now: new Date().toISOString()');
    expect(route).toContain('summary: {');
    expect(route).toContain('failures: result.failures');
    expect(route).not.toContain('results: result.results');
  });

  it('never caches money-moving admin responses', () => {
    expect(route).toContain("'Cache-Control', 'no-store, max-age=0'");
  });
});
