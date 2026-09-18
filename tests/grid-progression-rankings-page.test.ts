import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/grid/rankings/rankings-client.tsx'),
  'utf8',
);

describe('Grid rankings page contract', () => {
  it('offers the major multi-stat ranking categories', () => {
    for (const board of [
      'overall',
      'territory',
      'economy',
      'competitive',
      'discovery',
      'missions',
      'progression',
      'social',
      'legacy',
    ]) {
      expect(source).toContain(`key: '${board}'`);
    }
  });

  it('loads only the privacy-safe public progression leaderboard endpoint', () => {
    expect(source).toContain('/api/grid/progression/leaderboard');
    expect(source).not.toContain('playerId');
    expect(source).not.toContain('email');
  });
});
