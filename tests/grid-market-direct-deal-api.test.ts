import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isGridDirectDealReadEnabled,
  isGridDirectDealWriteEnabled,
} from '../lib/grid/server/direct-deal-feature-flags';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const rootRoute = read('app/api/grid/market/deals/route.ts');
const actionRoute = read('app/api/grid/market/deals/[proposalId]/route.ts');
const acceptRoute = read(
  'app/api/grid/market/deals/[proposalId]/accept/route.ts',
);
const client = read('app/grid/market/deals/grid-direct-deals-client.tsx');
const adapter = read('lib/grid/server/supabase-direct-deal-market.ts');
const service = read('lib/grid/server/direct-deal-market-service.ts');

describe('Grid Direct Deal authenticated API contract', () => {
  it('keeps private deal reads and writes independently gated', () => {
    expect(isGridDirectDealReadEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isGridDirectDealWriteEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isGridDirectDealReadEnabled({
        NODE_ENV: 'test',
        GRID_DIRECT_DEAL_READ_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isGridDirectDealWriteEnabled({
        NODE_ENV: 'test',
        GRID_DIRECT_DEAL_WRITE_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('creates deals by callsign and slugs, never browser-supplied authority ids', () => {
    expect(rootRoute).toContain('body.counterpartyCallsign');
    expect(rootRoute).toContain('body.proposerPropertySlugs');
    expect(rootRoute).toContain('proposerPlayerId: session.player.id');
    expect(rootRoute).not.toContain('body.counterpartyPlayerId');
    expect(rootRoute).not.toContain('body.proposerPlayerId');
    expect(rootRoute).not.toContain('body.propertyIds');
    expect(rootRoute).not.toContain('body.seasonId');
    expect(adapter).toContain("rpc('grid_resolve_chat_callsign'");
  });

  it('accepts only proposal id plus idempotency from the browser', () => {
    expect(acceptRoute).toContain('context.params.proposalId');
    expect(acceptRoute).toContain('body.idempotencyKey');
    expect(acceptRoute).toContain('playerId: session.player.id');
    expect(acceptRoute).not.toContain('body.transaction');
    expect(acceptRoute).not.toContain('body.acceptingPlayerId');
    expect(acceptRoute).not.toContain('body.playerId');
    expect(service).toContain('planGridDirectDealSettlement(');
    expect(service).toContain('buildGridMarketTransactionFromDirectDeal({');
  });

  it('derives proposer-only cancellation from the authenticated session', () => {
    expect(actionRoute).toContain('export async function DELETE');
    expect(actionRoute).toContain('playerId: session.player.id');
    expect(actionRoute).not.toContain('body.proposerPlayerId');
    expect(actionRoute).not.toContain('body.seasonId');
  });

  it('limits proposal reads to rows where the viewer is a participant', () => {
    expect(adapter).toContain(".eq('status', 'open')");
    expect(adapter).toContain(".gt('expires_at', now)");
    expect(adapter).toContain('proposer_player_id.eq.');
    expect(adapter).toContain('counterparty_player_id.eq.');
    expect(rootRoute).toContain("'Cache-Control', 'private, no-store, max-age=0'");
  });

  it('keeps the UI privacy-safe while exposing create, accept, and cancel', () => {
    expect(client).toContain('Counterparty callsign');
    expect(client).toContain('proposerPropertySlugs: selectedProperties');
    expect(client).toContain('Accept exact terms');
    expect(client).toContain('Cancel proposal');
    expect(client).toContain('It does not expose which');
    expect(client).not.toContain('counterpartyPlayerId');
    expect(client).not.toContain('proposerPlayerId');
    expect(client).not.toContain('propertyId');
  });
});
