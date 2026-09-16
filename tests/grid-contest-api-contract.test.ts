import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const startRoute = fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/contests/route.ts'),
  'utf8',
);
const roundRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/grid/contests/[contestId]/round/route.ts',
  ),
  'utf8',
);
const withdrawRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/grid/contests/[contestId]/withdraw/route.ts',
  ),
  'utf8',
);

describe('Grid contest command API contract', () => {
  it('keeps all contest writes disabled behind an explicit flag', () => {
    expect(startRoute).toContain('isGridContestWriteEnabled()');
    expect(roundRoute).toContain('isGridContestWriteEnabled()');
    expect(withdrawRoute).toContain('isGridContestWriteEnabled()');
  });

  it('derives the attacker from authenticated session instead of request JSON', () => {
    expect(startRoute).toContain('attackerPlayerId: session.player.id');
    expect(roundRoute).toContain('attackerPlayerId: session.player.id');
    expect(withdrawRoute).toContain('attackerPlayerId: session.player.id');
    expect(startRoute).not.toMatch(/body\.attackerPlayerId|body\.defenderPlayerId/);
    expect(roundRoute).not.toMatch(/body\.attackerPlayerId/);
    expect(withdrawRoute).not.toMatch(/body\.attackerPlayerId/);
  });

  it('generates command time and Signal Dice only on the server', () => {
    expect(startRoute).toContain('now: new Date().toISOString()');
    expect(roundRoute).toContain('cryptoSignalDiceRoller');
    expect(roundRoute).toContain('now: new Date().toISOString()');
    expect(withdrawRoute).toContain('now: new Date().toISOString()');
    expect(startRoute).not.toMatch(/body\.now|body\.defenderCommittedInfluence|body\.defenseTactic/);
    expect(roundRoute).not.toMatch(/body\.attackerRolls|body\.defenderRolls|body\.now/);
    expect(withdrawRoute).not.toMatch(/body\.now/);
  });

  it('requires an idempotency key for retry-safe player commands', () => {
    expect(startRoute).toContain('Missing idempotencyKey.');
    expect(roundRoute).toContain('Missing idempotencyKey.');
    expect(withdrawRoute).toContain('Missing idempotencyKey.');
  });

  it('launches attacks through the persisted offline-defense doctrine path', () => {
    expect(startRoute).toContain('launchGridContestAttack');
    expect(startRoute).toContain('createSupabaseGridContestAttackPort');
    expect(startRoute).toContain('createSupabaseGridOfflineDefensePolicyPort');
    expect(startRoute).toContain('createSupabaseGridEconomyCommandPort');
    expect(startRoute).toContain('createSupabaseGridContestSessionPort');
    expect(startRoute).toContain('cantonFoundingSeasonPackage.seasonTemplate.contest');
  });
});
