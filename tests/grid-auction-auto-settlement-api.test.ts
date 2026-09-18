import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const activeRoute = read('app/api/grid/auctions/active/route.ts');
const adapter = read(
  'lib/grid/server/supabase-auction-settlement-sweep.ts',
);
const service = read(
  'lib/grid/server/auction-settlement-sweep-service.ts',
);

describe('Grid auction auto-settlement API contract', () => {
  it('sweeps expired auctions only when auction writes are enabled', () => {
    expect(activeRoute).toContain('isGridAuctionWriteEnabled()');
    expect(activeRoute).toContain('settleExpiredGridAuctions(');
    expect(activeRoute.indexOf('settleExpiredGridAuctions(')).toBeLessThan(
      activeRoute.indexOf('listGridActiveAuctions('),
    );
    expect(activeRoute).toContain('{ seasonId, now, limit: 25 }');
  });

  it('discovers only expired scheduled/open auctions in a bounded query', () => {
    expect(adapter).toContain(".in('status', ['scheduled', 'open'])");
    expect(adapter).toContain(".lte('ends_at', now)");
    expect(adapter).toContain(".order('ends_at', { ascending: true })");
    expect(adapter).toContain('.limit(limit)');
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
  });

  it('derives settlement idempotency keys on the server instead of accepting browser terms', () => {
    expect(service).toContain("'auction:auto-settle:' + auctionId");
    expect(activeRoute).not.toContain('body.idempotencyKey');
    expect(activeRoute).not.toContain('searchParams');
    expect(activeRoute).toContain('settlementWarning');
  });
});
