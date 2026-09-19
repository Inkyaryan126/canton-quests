import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/grid/season-history/route.ts'),
  'utf8',
);
const client = fs.readFileSync(
  path.join(root, 'app/grid/history/grid-season-history-client.tsx'),
  'utf8',
);
const rankings = fs.readFileSync(
  path.join(root, 'app/grid/rankings/rankings-client.tsx'),
  'utf8',
);
const page = fs.readFileSync(
  path.join(root, 'app/grid/history/page.tsx'),
  'utf8',
);

describe('Grid Season History public UI contract', () => {
  it('keeps the API behind the world-read activation gate', () => {
    expect(route).toContain('isGridWorldReadEnabled()');
    expect(route).toContain('enabled: false');
    expect(route).toContain('readPublicGridSeasonHistory(');
    expect(route).not.toContain('resolveAuthenticatedSession');
  });

  it('derives the only readable city and season from the package', () => {
    expect(route).toContain('cantonFoundingSeasonPackage.city.slug');
    expect(route).toContain(
      'cantonFoundingSeasonPackage.seasonTemplate.slug',
    );
    expect(route).not.toContain('searchParams');
    expect(route).not.toContain('request.json');
  });

  it('uses long cache only after the record is immutable', () => {
    expect(route).toContain('history.archive');
    expect(route).toContain('s-maxage=300');
    expect(route).toContain('s-maxage=15');
  });

  it('shows loading, offline, pre-archive, champion, and standings states', () => {
    expect(client).toContain("fetch('/api/grid/season-history'");
    expect(client).toContain('Reading permanent record');
    expect(client).toContain('Archive Offline');
    expect(client).toContain('No Archived Season Yet');
    expect(client).toContain('City Champion');
    expect(client).toContain('Final Standings');
    expect(client).toContain('City Power');
    expect(client).toContain('Grid Rating');
  });

  it('links live rankings to permanent history and keeps the page no-index', () => {
    expect(rankings).toContain('href="/grid/history"');
    expect(rankings).toContain('Season History');
    expect(page).toContain('index: false');
    expect(page).toContain('follow: false');
  });

  it('states and structurally respects the public privacy boundary', () => {
    expect(client).toContain(
      'Player UUIDs and private account data never leave the server.',
    );
    expect(route).not.toContain('playerId');
    expect(route).not.toContain('seasonId');
  });
});
