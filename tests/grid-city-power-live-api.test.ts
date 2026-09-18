import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/city-power/leaderboard/route.ts'),
  'utf8',
);
const rankings = fs.readFileSync(
  path.join(root, 'app/grid/rankings/rankings-client.tsx'),
  'utf8',
);

describe('Grid City Power live read contract', () => {
  it('keeps the public board behind the world-read launch gate', () => {
    expect(route).toContain('isGridWorldReadEnabled()');
    expect(route).toContain("board: { type: 'city-power' }");
    expect(route).toContain('enabled: false');
    expect(route).not.toContain('resolveAuthenticatedSession');
  });

  it('derives score from Canton package config and authoritative progression snapshots', () => {
    expect(route).toContain('cantonFoundingSeasonPackage.seasonTemplate.cityPower');
    expect(route).toContain('buildPublicGridCityPowerLeaderboard(');
    expect(route).toContain('createSupabaseGridProgressionLeaderboardDataPort()');
    expect(route).toContain('resolveSupabaseGridSeason');
  });

  it('keeps public caching bounded like the existing progression leaderboard', () => {
    expect(route).toContain("'Cache-Control'");
    expect(route).toContain('s-maxage=15');
    expect(route).toContain('stale-while-revalidate=30');
  });

  it('makes City Power the primary rankings board without removing specialist boards', () => {
    expect(rankings).toContain("| 'city-power'");
    expect(rankings).toContain("useState<BoardKey>('city-power')");
    expect(rankings).toContain("key: 'city-power'");
    expect(rankings).toContain("'/api/grid/city-power/leaderboard?limit=50'");
    expect(rankings).toContain('/api/grid/progression/leaderboard?board=');
    expect(rankings).toContain('City Power is the seasonal main score');
  });
});
