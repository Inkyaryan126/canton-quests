import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const returnClient = fs.readFileSync(
  path.join(process.cwd(), 'app/grid/return/grid-return-client.tsx'),
  'utf8',
);
const publicGrid = fs.readFileSync(path.join(process.cwd(), 'app/grid/page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

describe('Grid Passport private discovery', () => {
  it('surfaces Passport from the authenticated Return summary', () => {
    const summaryGate = returnClient.indexOf('{summary ? (');
    const passportLink = returnClient.indexOf('href="/grid/passport"');
    expect(summaryGate).toBeGreaterThan(-1);
    expect(passportLink).toBeGreaterThan(summaryGate);
    expect(returnClient).toContain('GRID PASSPORT');
    expect(returnClient).toContain('<Stamp size={17}');
  });

  it('does not expose the private Passport from the public Grid Coming Soon page', () => {
    expect(publicGrid).not.toContain('/grid/passport');
    expect(publicGrid).not.toContain('GRID PASSPORT');
  });

  it('uses CQ-prefixed custom styling for the new action', () => {
    expect(returnClient).toContain('className="cq-grid-return-passport-link"');
    expect(returnClient).toContain('className="cq-grid-return-tools"');
    expect(css).toContain('.cq-grid-return-passport-link');
    expect(css).toContain('.cq-grid-return-tools');
  });
});
