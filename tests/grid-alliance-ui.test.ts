import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = path.join(process.cwd(), 'app/grid/alliances/page.tsx');
const clientPath = path.join(process.cwd(), 'app/grid/alliances/alliances-client.tsx');
const pageSource = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
const clientSource = fs.existsSync(clientPath) ? fs.readFileSync(clientPath, 'utf8') : '';
const cssSource = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

describe('GRID Alliance player surface', () => {
  it('keeps the player screen hidden until the Alliance feature is enabled', () => {
    expect(pageSource).toContain('isGridAllianceEnabled()');
    expect(pageSource).toContain('notFound()');
    expect(pageSource).toContain("robots: { index: false, follow: false }");
  });

  it('loads the sanitized Alliance directory and covers the complete player lifecycle', () => {
    expect(clientSource).toContain("fetch('/api/grid/alliances'");
    expect(clientSource).toContain("method: 'POST'");
    expect(clientSource).toContain("/join");
    expect(clientSource).toContain("/leave");
    expect(clientSource).toContain("/contribute");
    expect(clientSource).toContain("/disband");
    expect(clientSource).toContain('CREATE ALLIANCE');
    expect(clientSource).toContain('JOIN ALLIANCE');
    expect(clientSource).toContain('CONTRIBUTE INFLUENCE');
  });

  it('never asks the browser to provide player or season authority', () => {
    expect(clientSource).not.toMatch(/playerId\s*:/);
    expect(clientSource).not.toMatch(/body\s*:\s*\{[^}]*seasonId\s*:/s);
    expect(clientSource).not.toMatch(/leaderPlayerId\s*:/);
    expect(clientSource).not.toMatch(/influencePoolAfter\s*:/);
  });

  it('reports the server-accepted contribution instead of assuming the whole request fit the pool', () => {
    expect(clientSource).toContain('acceptedInfluence');
    expect(clientSource).toContain('poolInfluenceAfter');
    expect(clientSource).toContain('accepted into the Alliance pool');
  });

  it('uses retry-safe command keys for irreversible pooled-resource and disband commands', () => {
    expect(clientSource).toContain("commandKey('contribute:'");
    expect(clientSource).toContain("commandKey('disband:'");
    expect(clientSource).toContain('window.crypto.randomUUID()');
    expect(clientSource).toContain('clearCommandKey');
  });

  it('keeps leader disband separate from ordinary member leave', () => {
    expect(clientSource).toContain("current.role === 'leader'");
    expect(clientSource).toContain('DISBAND ALLIANCE');
    expect(clientSource).toContain('LEAVE ALLIANCE');
    expect(clientSource).toContain('pooled Influence is not refunded');
  });

  it('uses repository-safe CQ-prefixed CSS instead of new utility-class styling', () => {
    expect(clientSource).toContain('cq-grid-alliance');
    expect(cssSource).toContain('.cq-grid-alliance');
    expect(clientSource).not.toMatch(/className="(?:flex|grid|w-|h-|p-|m-|gap-|text-|bg-|border-|rounded-)/);
  });

  it('keeps Alliance coordination distinct from shared scoring', () => {
    expect(clientSource).toContain('Your score stays yours');
    expect(clientSource).toContain('coordination');
  });
});
