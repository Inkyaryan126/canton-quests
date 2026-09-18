import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, 'app/grid/defense/page.tsx'),
  'utf8',
);
const client = fs.readFileSync(
  path.join(root, 'app/grid/defense/grid-defense-client.tsx'),
  'utf8',
);

describe('Grid offline defense player UI contract', () => {
  it('keeps the doctrine screen private and no-index', () => {
    expect(page).toContain('index: false');
    expect(page).toContain('follow: false');
    expect(page).toContain('GridDefenseClient');
  });

  it('loads the persisted policy and private world projection', () => {
    expect(client).toContain("fetch('/api/grid/offline-defense'");
    expect(client).toContain("fetch('/api/grid/world'");
    expect(client).toContain("cache: 'no-store'");
    expect(client).toContain('DEFAULT_GRID_OFFLINE_DEFENSE_POLICY');
    expect(client).toContain("territory.ownership === 'you'");
  });

  it('handles auth and feature gating without inventing a client fallback write path', () => {
    expect(client).toContain('policyResponse.status === 401');
    expect(client).toContain('policyResponse.status === 404');
    expect(client).toContain('href="/login"');
    expect(client).toContain('Defense controls staged');
  });

  it('exposes every persisted global defense rule', () => {
    for (const field of [
      'reserveInfluence',
      'maxCommitPerContest',
      'defaultCommitBps',
      'autoRetreatBelowInfluence',
      'autoRetreatAfterLosses',
      'defaultTactic',
    ]) {
      expect(client).toContain(field);
    }
    for (const tactic of ['fortify', 'pressure', 'flank', 'feint']) {
      expect(client).toContain(tactic);
    }
  });

  it('lets owned territories opt into exact priority, commit, and tactic overrides', () => {
    expect(client).toContain('priorityRules');
    expect(client).toContain('territorySlug');
    expect(client).toContain('priority:');
    expect(client).toContain('commitBps:');
    expect(client).toContain('tactic:');
    expect(client).toContain('OVERRIDE ON');
    expect(client).toContain('USE GLOBAL');
  });

  it('writes only policy plus a retry key and never browser authority identities', () => {
    expect(client).toContain("method: 'PUT'");
    expect(client).toContain('JSON.stringify({');
    expect(client).toContain('policy,');
    expect(client).toContain('idempotencyKey: commandKey(scope)');
    expect(client).not.toContain('playerId');
    expect(client).not.toContain('seasonId');
    expect(client).not.toContain('defenderPlayerId');
  });

  it('keeps idempotency stable until the doctrine save succeeds', () => {
    expect(client).toContain("window.sessionStorage.getItem(storageKey)");
    expect(client).toContain("window.sessionStorage.setItem(storageKey, key)");
    expect(client).toContain('clearCommandKey(scope)');
    expect(client.indexOf('clearCommandKey(scope)')).toBeGreaterThan(
      client.indexOf('if (!response.ok'),
    );
  });

  it('explains that contest losses, not commitment itself, determine burned Influence', () => {
    expect(client).toContain('Influence is committed into a contest, not automatically burned.');
    expect(client).toContain('Contest losses determine what is actually lost.');
  });
});
