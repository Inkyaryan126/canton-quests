import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const page = fs.readFileSync(path.join(process.cwd(), 'app/grid/passport/page.tsx'), 'utf8');
const client = fs.readFileSync(path.join(process.cwd(), 'app/grid/passport/grid-passport-client.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
describe('Grid Passport player UI', () => {
  it('renders the canonical replayable projection rather than a duplicate visit-stamp model', () => {
    expect(page).toContain("title: 'Grid Passport | Canton Quests'");
    expect(client).toContain('passport.citiesEntered.length');
    expect(client).toContain('passport.nationalReputation');
    expect(client).toContain('passport.lifetimeTerritoriesControlled');
    expect(client).toContain('passport.peakRank');
    expect(client).toContain('passport.processedEventCount');
    expect(client).not.toContain('entryCount');
    expect(client).not.toContain('firstEnteredAt');
  });
  it('handles auth, staged runtime, missing cache, and invalid cache explicitly', () => {
    expect(client).toContain('PLAYER AUTHENTICATION REQUIRED');
    expect(client).toContain('PASSPORT SIGNAL STAGED');
    expect(client).toContain('FIRST STAMP WAITING');
    expect(client).toContain('PASSPORT REBUILD REQUIRED');
  });
  it('uses only CQ-prefixed class names for the new Passport surface', () => {
    const values = [...client.matchAll(/className="([^"]+)"/g)].map((match) => match[1]);
    expect(values.length).toBeGreaterThan(15);
    expect(values.every((value) => value.split(/\s+/).every((name) => name.startsWith('cq-grid-passport-')))).toBe(true);
    expect(css).toContain('.cq-grid-passport-shell');
  });
});
