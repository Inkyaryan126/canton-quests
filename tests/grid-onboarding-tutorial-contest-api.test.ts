import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const route = read(
  'app/api/grid/onboarding/tutorial-contest/route.ts',
);
const service = read(
  'lib/grid/server/onboarding-tutorial-contest-service.ts',
);
const adapter = read(
  'lib/grid/server/supabase-onboarding-tutorial-contest.ts',
);

describe('Grid onboarding tutorial contest API contract', () => {
  it('is authenticated and gated by onboarding writes', () => {
    expect(route).toContain('export async function POST');
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('isGridOnboardingWriteEnabled()');
    expect(route).toContain('Authentication required.');
  });

  it('accepts only an idempotency key from the browser', () => {
    expect(route).toContain('body.idempotencyKey');
    expect(route).not.toContain('body.playerId');
    expect(route).not.toContain('body.attackerRolls');
    expect(route).not.toContain('body.defenderRolls');
    expect(route).not.toContain('body.attackerCommittedInfluence');
    expect(route).toContain('playerId: session.player.id');
    expect(route).toContain('now: new Date().toISOString()');
  });
  it('uses server crypto dice and the real contest resolver', () => {
    expect(route).toContain('cryptoSignalDiceRoller');
    expect(service).toContain('resolveSignalDiceRound');
    expect(service).toContain('signalDiceForCommit');
    expect(service).toContain("'attacker',");
    expect(service).toContain("'defender',");
  });

  it('persists only a dedicated safe tutorial event', () => {
    expect(service).toContain("eventType: 'grid:tutorial_contest_completed'");
    expect(service).toContain("entityType: 'tutorial'");
    expect(service).toContain('safePractice: true');
    expect(service).toContain('walletMutation: false');
    expect(service).toContain('territoryMutation: false');
    expect(service).not.toContain('settleGridPlayerResources');
    expect(service).not.toContain('startGridContest');
    expect(service).not.toContain('resolveGridContestSessionRound');
  });

  it('resolves city and season with a read-only service-role adapter', () => {
    expect(adapter).toContain(".from('grid_cities')");
    expect(adapter).toContain(".from('grid_seasons')");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });
});
