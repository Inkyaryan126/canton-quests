import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/supabase-pve-stronghold-session.ts'),
  'utf8',
);

describe('Supabase Grid PvE stronghold adapter', () => {
  it('requires an injected trusted stronghold resolver instead of accepting client garrison data', () => {
    expect(source).toContain('resolveStronghold: GridPveStrongholdResolver');
    expect(source).toContain('await options.resolveStronghold');
    expect(source).toContain('stronghold.objective.territorySlug');
  });

  it('resolves city, season, source, and target identities from server data', () => {
    expect(source).toContain(".from('grid_cities')");
    expect(source).toContain(".from('grid_seasons')");
    expect(source.match(/\.from\('grid_territories'\)/g)?.length).toBe(2);
    expect(source).toContain(".eq('slug', stronghold.objective.territorySlug)");
    expect(source).toContain(".eq('slug', request.sourceTerritorySlug)");
  });

  it('calls only the dedicated PvE RPCs for state changes', () => {
    expect(source).toContain("client.rpc('grid_start_pve_stronghold_contest'");
    expect(source).toContain("client.rpc('grid_resolve_pve_stronghold_round'");
    expect(source).toContain("client.rpc('grid_withdraw_pve_stronghold_contest'");
    expect(source).not.toContain("client.rpc('grid_start_contest'");
  });

  it('reads persisted remaining garrison state before server-generated rounds', () => {
    expect(source).toContain(".from('grid_pve_stronghold_contests')");
    expect(source).toContain('garrison_remaining_influence');
    expect(source).toContain('attacker_remaining_influence');
  });
});
