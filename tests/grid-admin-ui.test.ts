import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, 'app/api/admin/grid/overview/route.ts'),
  'utf8',
);
const page = fs.readFileSync(
  path.join(root, 'app/admin/grid/grid-admin-client.tsx'),
  'utf8',
);
const css = fs.readFileSync(
  path.join(root, 'app/admin/grid/grid-admin.css'),
  'utf8',
);

describe('Grid Game Master admin contracts', () => {
  it('keeps the overview endpoint read-only behind the canonical admin session', () => {
    expect(route).toContain('resolveAdminSessionFromRequest');
    expect(route).toContain("status: 401");
    expect(route).toContain('export async function GET');
    expect(route).not.toMatch(
      /export async function (POST|PUT|PATCH|DELETE)/,
    );
  });

  it('renders operations domains with safe empty and error states', () => {
    for (const label of [
      'Season state',
      'Runtime maintenance',
      'Player lookup',
      'Territory control',
      'Active contests',
      'Auctions',
      'Market activity',
      'NPC strongholds',
      'Dynamic events',
      'Audit activity',
    ]) {
      expect(page).toContain(label);
    }
    expect(page).toContain('No activity recorded yet.');
    expect(page).toContain('Unable to load Grid operations data.');
  });

  it('runs the dedicated maintenance endpoint with no client-supplied authority', () => {
    expect(page).toContain("fetch('/api/admin/grid/runtime/sweep'");
    expect(page).toContain("method: 'POST'");
    expect(page).not.toContain('seasonId:');
    expect(page).not.toContain('citySlug:');
    expect(page).not.toContain('seasonSlug:');
    expect(page).not.toContain('auctionSettlementEnabled:');
    expect(page).not.toContain('contractRewardSettlementEnabled:');
  });

  it('shows lifecycle, auction, and reward outcomes instead of hiding partial failure', () => {
    expect(page).toContain('Season lifecycle');
    expect(page).toContain('Expired auctions');
    expect(page).toContain('Contract rewards');
    expect(page).toContain(
      'Maintenance completed with one or more failures.',
    );
    expect(page).toContain('already settled');
    expect(page).toContain('duplicates');
  });

  it('refreshes the live overview after a maintenance sweep finishes', () => {
    const setResult = page.indexOf('setMaintenanceResult(body.result)');
    const reload = page.indexOf('await load(query)', setResult);
    expect(setResult).toBeGreaterThanOrEqual(0);
    expect(reload).toBeGreaterThan(setResult);
  });

  it('keeps the maintenance control usable on narrow screens', () => {
    expect(css).toContain('.cq-grid-admin__maintenance-head');
    expect(css).toContain('.cq-grid-admin__maintenance-results');
    expect(css).toContain('grid-template-columns: 1fr');
    expect(css).toContain('.cq-grid-admin__maintenance-button');
  });
});
