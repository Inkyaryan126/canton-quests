import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/dominance-heat/route.ts'),
  'utf8',
);
const page = fs.readFileSync(
  path.join(root, 'app/grid/heat/page.tsx'),
  'utf8',
);
const client = fs.readFileSync(
  path.join(root, 'app/grid/heat/grid-dominance-heat-client.tsx'),
  'utf8',
);
const returnClient = fs.readFileSync(
  path.join(root, 'app/grid/return/grid-return-client.tsx'),
  'utf8',
);
const publicGrid = fs.readFileSync(
  path.join(root, 'app/grid/page.tsx'),
  'utf8',
);

describe('live Grid Dominance Heat API and player UI contract', () => {
  it('requires authenticated private reads behind the Grid world-read gate', () => {
    const auth = route.indexOf('resolveAuthenticatedSession(request)');
    const read = route.indexOf('readGridDominanceHeatLive(');
    expect(auth).toBeGreaterThanOrEqual(0);
    expect(read).toBeGreaterThan(auth);
    expect(route).toContain('isGridWorldReadEnabled()');
    expect(route).toContain("status: 401");
    expect(route).toContain("status: 404");
    expect(route).toContain("'Cache-Control', 'private, no-store, max-age=0'");
  });

  it('derives player identity, city, season, and Heat config server-side', () => {
    expect(route).toContain('session.player.id');
    expect(route).toContain('cantonFoundingSeasonPackage');
    expect(route).toContain('cantonDominanceHeatConfig');
    expect(route).toContain('createSupabaseGridDominanceHeatLivePort(');
    expect(route).not.toContain('request.json');
    expect(route).not.toContain('searchParams');
    expect(route).not.toContain('body.playerId');
    expect(route).not.toContain('body.allianceId');
  });

  it('keeps the strategy page private/no-index and off the public teaser', () => {
    expect(page).toContain('index: false');
    expect(page).toContain('follow: false');
    expect(returnClient).toContain('href="/grid/heat"');
    expect(returnClient).toContain('HEAT');
    expect(publicGrid).not.toContain('href="/grid/heat"');
  });

  it('renders player and alliance exposure from the sanitized Heat endpoint', () => {
    expect(client).toContain("fetch('/api/grid/dominance-heat'");
    expect(client).toContain("cache: 'no-store'");
    expect(client).toContain('PERSONAL EXPOSURE');
    expect(client).toContain('ALLIANCE EXPOSURE');
    expect(client).toContain('Warm 35%');
    expect(client).toContain('Hot 50%');
    expect(client).toContain('Critical 75%');
    expect(client).toContain('controlledTerritories');
    expect(client).toContain('eligibleTerritories');
  });

  it('labels counter-pressure as projected instead of falsely claiming live enforcement', () => {
    expect(client).toContain('Projection, not silent enforcement');
    expect(client).toContain('Projected NPC counter-pressure.');
    expect(client).toContain('Projected concentration surcharge.');
    expect(client).toContain('does');
    expect(client).toContain('not claim a surcharge or bonus has already been charged or');
    expect(client).toContain('Strategic-value concentration stays disabled');
  });

  it('handles authentication, disabled runtime, join-required, and unavailable states', () => {
    expect(client).toContain('response.status === 401');
    expect(client).toContain('response.status === 404');
    expect(client).toContain('Player authentication required');
    expect(client).toContain('Heat signal staged');
    expect(client).toContain("heat?.state === 'join-required'");
    expect(client).toContain('Join the season first');
    expect(client).toContain('Heat cannot be measured yet');
  });

  it('never exposes internal actor/player/alliance identifiers in the client contract', () => {
    expect(client).not.toContain('actorId');
    expect(client).not.toContain('playerId');
    expect(client).not.toContain('allianceId');
    expect(client).not.toContain('seasonId');
  });
});
