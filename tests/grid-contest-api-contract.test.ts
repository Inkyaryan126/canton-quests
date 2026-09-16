import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

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
    expect(roundRoute).toContain('isGridContestWriteEnabled()');
    expect(withdrawRoute).toContain('isGridContestWriteEnabled()');
  });

  it('derives the attacker from authenticated session instead of request JSON', () => {
    expect(roundRoute).toContain('attackerPlayerId: session.player.id');
    expect(withdrawRoute).toContain('attackerPlayerId: session.player.id');
    expect(roundRoute).not.toMatch(/body\.attackerPlayerId/);
    expect(withdrawRoute).not.toMatch(/body\.attackerPlayerId/);
  });

  it('generates Signal Dice and command time only on the server', () => {
    expect(roundRoute).toContain('cryptoSignalDiceRoller');
    expect(roundRoute).toContain('now: new Date().toISOString()');
    expect(withdrawRoute).toContain('now: new Date().toISOString()');
    expect(roundRoute).not.toMatch(/body\.attackerRolls|body\.defenderRolls|body\.now/);
    expect(withdrawRoute).not.toMatch(/body\.now/);
  });

  it('requires an idempotency key for retry-safe player commands', () => {
    expect(roundRoute).toContain('Missing idempotencyKey.');
    expect(withdrawRoute).toContain('Missing idempotencyKey.');
  });

  it('does not expose a contest-start route before defender doctrine is integrated', () => {
    expect(
      fs.existsSync(
        path.join(process.cwd(), 'app/api/grid/contests/route.ts'),
      ),
    ).toBe(false);
  });
});
