import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    'lib/grid/server/supabase-contract-reward-settlement.ts',
  ),
  'utf8',
);

describe('Supabase Grid Contract reward settlement adapter contract', () => {
  it('discovers only pending outbox rows in deterministic bounded order', () => {
    expect(source).toContain(".from('grid_contract_reward_outbox')");
    expect(source).toContain(".is('processed_at', null)");
    expect(source).toContain(".order('created_at', { ascending: true })");
    expect(source).toContain(".order('id', { ascending: true })");
    expect(source).toContain('.limit(limit)');
  });

  it('mutates only through the dedicated atomic reward RPC', () => {
    expect(source).toContain("client.rpc('grid_settle_contract_reward'");
    expect(source).not.toMatch(
      /\.from\('grid_contract_reward_outbox'\).*\.(update|delete|upsert|insert)\(/s,
    );
    expect(source).not.toMatch(
      /\.from\('grid_player_season_state'\).*\.(update|upsert|insert)\(/s,
    );
  });

  it('accepts numeric JSON values or safe numeric strings from PostgREST', () => {
    expect(source).toContain("typeof value === 'string'");
    expect(source).toContain('Number.isSafeInteger(parsed)');
    expect(source).toContain("safeInteger(row.credits, 'credits')");
  });

  it('validates reward kind and outcome rather than trusting arbitrary strings', () => {
    expect(source).toContain("rewardKind !== 'contract'");
    expect(source).toContain("rewardKind !== 'location-bonus'");
    expect(source).toContain("outcome !== 'applied'");
    expect(source).toContain("outcome !== 'duplicate'");
  });
});
