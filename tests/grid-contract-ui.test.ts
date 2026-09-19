import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'app/grid/contracts/page.tsx'), 'utf8');
const client = fs.readFileSync(
  path.join(root, 'app/grid/contracts/grid-contracts-client.tsx'),
  'utf8',
);
const publicGrid = fs.readFileSync(path.join(root, 'app/grid/page.tsx'), 'utf8');

describe('Grid player Contracts UI', () => {
  it('ships a private contracts page and a clear Grid entry point', () => {
    expect(page).toContain("title: 'Contracts | The Grid'");
    expect(page).toContain('<GridContractsClient />');
    expect(publicGrid).toContain('href="/grid/contracts"');
    expect(publicGrid).toContain('CONTRACTS');
  });

  it('reads only the authenticated private Contract GET APIs', () => {
    expect(client).toContain("/api/grid/contracts?cityId=");
    expect(client).toContain('/api/grid/contracts/${encodeURIComponent(contractId)}?cityId=');
    expect(client).toContain('encodeURIComponent(contractId)');
    expect(client).toContain("cache: 'no-store'");
    expect(client).not.toContain("method: 'POST'");
    expect(client).not.toContain("method: 'PUT'");
    expect(client).not.toContain("method: 'PATCH'");
    expect(client).not.toContain("method: 'DELETE'");
    expect(client).not.toContain('playerId');
    expect(client).not.toContain('progressEvent');
  });

  it('handles authentication, staged runtime, empty, loading, and error states', () => {
    for (const label of [
      'PLAYER AUTHENTICATION REQUIRED',
      'CONTRACT SIGNAL STAGED',
      'NO ACTIVE CONTRACTS',
      'SCANNING CONTRACT LEDGER',
      'CONTRACT SIGNAL LOST',
    ]) {
      expect(client).toContain(label);
    }
    expect(client).toContain('response.status === 401');
    expect(client).toContain('response.status === 404');
    expect(client).toContain('href="/login"');
  });

  it('renders server-derived progress, rewards, expiration, and read-only detail', () => {
    expect(client).toContain('contract.objectives.map');
    expect(client).toContain('contract.reward.credits');
    expect(client).toContain('contract.reward.influence');
    expect(client).toContain('contract.reward.commandPoints');
    expect(client).toContain('state.expiresAtMs');
    expect(client).toContain('state.status');
    expect(client).toContain('selectedContractId');
    expect(client).toContain('contractDetail');
    expect(client).toContain('aria-expanded');
    expect(client).toContain('setContractDetail(null);');
  });

  it('keeps new presentation classes scoped and mobile responsive', () => {
    const classNames = [...client.matchAll(/className="([^"]+)"/g)]
      .flatMap((match) => match[1].split(/\s+/))
      .filter(Boolean);
    expect(classNames.length).toBeGreaterThan(20);
    expect(classNames.every((name) => name.startsWith('cq-grid-contracts-'))).toBe(true);
    expect(client + publicGrid).toContain('.cq-grid-contracts-shell');
    expect(client + publicGrid).toContain('@media (max-width: 760px)');
  });
});
