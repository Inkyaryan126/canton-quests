import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}

describe('Grid progression API safety contract', () => {
  it('keeps progression rebuild writes behind a dedicated opt-in flag', () => {
    const flags = source('lib/grid/server/progression-feature-flags.ts');
    expect(flags).toContain("env.GRID_PROGRESSION_REBUILD_ENABLED === '1'");
  });

  it('rebuilds only the authenticated session player and does not accept a body player id', () => {
    const route = source('app/api/grid/progression/rebuild/route.ts');
    expect(route).toContain('session.player?.id');
    expect(route).toContain('rebuildGridPlayerProgression');
    expect(route).not.toContain('request.json()');
    expect(route).not.toContain('body.playerId');
  });

  it('keeps the public leaderboard on a read-only GET surface', () => {
    const route = source('app/api/grid/progression/leaderboard/route.ts');
    expect(route).toContain('export async function GET');
    expect(route).not.toContain('export async function POST');
    expect(route).toContain('buildPublicGridProgressionLeaderboard');
  });
});
