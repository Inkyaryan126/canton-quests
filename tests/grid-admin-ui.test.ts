import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/api/admin/grid/overview/route.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app/admin/grid/grid-admin-client.tsx'), 'utf8');

describe('Grid Game Master admin contracts', () => {
  it('requires the canonical server-side admin session and exposes read-only GET only', () => {
    expect(route).toContain('resolveAdminSessionFromRequest');
    expect(route).toContain("status: 401");
    expect(route).toContain('export async function GET');
    expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
  });

  it('renders operations domains with safe empty and error states', () => {
    for (const label of ['Season state', 'Player lookup', 'Territory control', 'Active contests', 'Auctions', 'Market activity', 'NPC strongholds', 'Dynamic events', 'Audit activity']) {
      expect(page).toContain(label);
    }
    expect(page).toContain('No activity recorded yet.');
    expect(page).toContain('Unable to load Grid operations data.');
  });
});
