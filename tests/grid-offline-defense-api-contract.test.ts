import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/grid/offline-defense/route.ts',
  ),
  'utf8',
);

describe('Grid offline defense API contract', () => {
  it('exposes only authenticated read/update handlers', () => {
    expect(route).toContain('export async function GET');
    expect(route).toContain('export async function PUT');
    expect(route).not.toMatch(/export async function (POST|PATCH|DELETE)/);
    expect(route).toContain('resolveAuthenticatedSession(request)');
    expect(route).toContain('Authentication required.');
  });

  it('keeps offline-defense access behind the explicit contest flag', () => {
    expect(route.match(/isGridContestWriteEnabled\(\)/g)?.length)
      .toBeGreaterThanOrEqual(2);
    expect(route).toContain('Grid contests are not enabled.');
  });

  it('derives player identity, season identity, and command time on the server', () => {
    expect(route).toContain('playerId: session.player.id');
    expect(route).toContain('resolveSupabaseGridSeasonId');
    expect(route).toContain('cantonFoundingSeasonPackage');
    expect(route).toContain('now: new Date().toISOString()');
    expect(route).not.toMatch(/body\.playerId/);
    expect(route).not.toMatch(/body\.seasonId/);
    expect(route).not.toMatch(/body\.now/);
  });

  it('requires retry-safe writes and accepts only the policy payload', () => {
    expect(route).toContain('Missing idempotencyKey.');
    expect(route).toContain('Missing offline defense policy.');
    expect(route).toContain('body.policy');
    expect(route).toContain('idempotencyKey');
  });

  it('routes all persistence through the offline-defense service layer', () => {
    expect(route).toContain('getGridOfflineDefensePolicy(');
    expect(route).toContain('setGridOfflineDefensePolicy(');
    expect(route).toContain('createSupabaseGridOfflineDefensePolicyPort()');
    expect(route).not.toMatch(/\.from\(|\.rpc\(/);
  });
});
