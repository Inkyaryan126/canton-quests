import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const client = fs.readFileSync(path.join(process.cwd(), 'app/grid/return/grid-return-client.tsx'), 'utf8');
const publicGrid = fs.readFileSync(path.join(process.cwd(), 'app/grid/page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
describe('Grid Passport private discovery', () => {
  it('links to Passport from a real authenticated Return summary', () => {
    expect(client.indexOf('href="/grid/passport"')).toBeGreaterThan(client.indexOf('{summary ? ('));
    expect(client).toContain('GRID PASSPORT');
    expect(client).toContain('cq-grid-return-passport-link');
    expect(css).toContain('.cq-grid-return-passport-link');
  });
  it('does not advertise the private Passport from the public Coming Soon page', () => {
    expect(publicGrid).not.toContain('/grid/passport');
    expect(publicGrid).not.toContain('GRID PASSPORT');
  });
});
