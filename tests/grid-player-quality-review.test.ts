import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  discoverGridPlayerSurfaces,
  reviewGridPlayerQuality,
} from '../scripts/grid-player-quality-review';

const tempDirs: string[] = [];
function repoWith(source: string, name = 'test-client.tsx'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-player-quality-'));
  tempDirs.push(root);
  const dir = path.join(root, 'app/grid/test');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), source);
  return root;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Grid private player performance/accessibility review', () => {
  it('passes the currently checked-in private Grid client surfaces', () => {
    const report = reviewGridPlayerQuality(process.cwd());
    expect(report.surfaceCount).toBeGreaterThanOrEqual(3);
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('discovers new private client surfaces automatically', () => {
    const root = repoWith(`'use client'; export default function X(){return null}`);
    expect(discoverGridPlayerSurfaces(root)).toEqual(['app/grid/test/test-client.tsx']);
  });

  it('rejects buttons without explicit type or touch-size guardrails', () => {
    const root = repoWith(`
      export default function X(){ return <button className="px-2">Continue</button>; }
    `);
    expect(reviewGridPlayerQuality(root).issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['button-missing-type', 'button-touch-target']),
    );
  });

  it('requires an accessible name for icon-only buttons', () => {
    const root = repoWith(`
      function Icon(){return null} export default function X(){
        return <button type="button" className="min-h-10"><Icon /></button>;
      }
    `);
    expect(reviewGridPlayerQuality(root).issues.map((issue) => issue.code)).toContain(
      'icon-only-control-name',
    );
  });

  it('accepts labeled icon-only buttons', () => {
    const root = repoWith(`
      function Icon(){return null} export default function X(){
        return <button type="button" aria-label="Refresh city" className="min-h-10"><Icon /></button>;
      }
    `);
    expect(reviewGridPlayerQuality(root).issues).toEqual([]);
  });

  it('requires alt text on native images', () => {
    const root = repoWith(`export default function X(){return <img src="/city.png" />}`);
    expect(reviewGridPlayerQuality(root).issues.map((issue) => issue.code)).toContain(
      'image-missing-alt',
    );
  });

  it('requires visibility throttling for persistent browser loops', () => {
    const root = repoWith(`
      export default function X(){ setInterval(() => fetch('/api/grid/world'), 5000); return null; }
    `);
    expect(reviewGridPlayerQuality(root).issues.map((issue) => issue.code)).toContain(
      'background-loop-unthrottled',
    );

    fs.writeFileSync(
      path.join(root, 'app/grid/test/test-client.tsx'),
      `export default function X(){ if (!document.hidden) setInterval(() => {}, 5000); return null; }`,
    );
    expect(reviewGridPlayerQuality(root).issues).toEqual([]);
  });
});
