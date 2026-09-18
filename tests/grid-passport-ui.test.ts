import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/grid/passport/page.tsx'), 'utf8');
const client = fs.readFileSync(path.join(process.cwd(), 'app/grid/passport/grid-passport-client.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

describe('Grid Passport player UI', () => {
  it('exposes the permanent record as a dedicated private-facing route', () => {
    expect(page).toContain("title: 'Grid Passport | Canton Quests'");
    expect(client).toContain("fetch('/api/grid/passport'");
    expect(client).toContain('PLAYER AUTHENTICATION REQUIRED');
    expect(client).toContain('NO GRID PROFILE YET');
  });

  it('shows permanent metrics and labeled city stamps without local economy balances', () => {
    expect(client).toContain('CITIES ENTERED');
    expect(client).toContain('CITY ENTRIES');
    expect(client).toContain('NATIONAL REPUTATION');
    expect(client).toContain("city?.name ?? 'Archived Grid City'");
    expect(client).toContain('HOME CITY');
    expect(client).not.toMatch(/credits|influence|command points/i);
  });

  it('uses CQ-prefixed custom styling rather than new Tailwind utility classes', () => {
    const classValues = [...client.matchAll(/className=\"([^\"]+)\"/g)].map((match) => match[1]);
    expect(classValues.length).toBeGreaterThan(10);
    expect(classValues.every((value) => value.split(/\s+/).every((name) => name.startsWith('cq-grid-passport-')))).toBe(true);
    expect(css).toContain('.cq-grid-passport-shell');
    expect(css).toContain('@media(max-width:700px)');
  });
});
