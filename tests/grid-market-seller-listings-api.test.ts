import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const listingsRoute = read('app/api/grid/market/listings/route.ts');
const detailRoute = read('app/api/grid/market/listings/[listingId]/route.ts');
const client = read(
  'app/grid/market/listings/grid-market-listings-client.tsx',
);
const service = read('lib/grid/server/market-listing-action-service.ts');

describe('Grid market seller listing contract', () => {
  it('adds guarded open and cancel writes without trusting browser authority', () => {
    expect(listingsRoute).toContain('export async function POST');
    expect(listingsRoute).toContain('isGridMarketListingWriteEnabled()');
    expect(listingsRoute).toContain('body.propertySlug');
    expect(listingsRoute).toContain('body.priceCredits');
    expect(listingsRoute).toContain('body.durationMinutes');
    expect(listingsRoute).toContain('body.idempotencyKey');
    expect(listingsRoute).not.toContain('body.sellerPlayerId');
    expect(listingsRoute).not.toContain('body.propertyId');
    expect(listingsRoute).not.toContain('body.seasonId');
    expect(listingsRoute).toContain('sellerPlayerId: session.player.id');

    expect(detailRoute).toContain('export async function DELETE');
    expect(detailRoute).toContain('isGridMarketListingWriteEnabled()');
    expect(detailRoute).toContain('sellerPlayerId: session.player.id');
    expect(detailRoute).not.toContain('body.sellerPlayerId');
    expect(detailRoute).not.toContain('body.seasonId');
  });

  it('uses deterministic server listing ids and the canonical market rules', () => {
    expect(service).toContain("const listingId = 'fixed:' + idempotencyKey");
    expect(service).toContain('GRID_MARKET_LISTING_RULES.minimumPriceCredits');
    expect(service).toContain('GRID_MARKET_LISTING_RULES.maximumPriceCredits');
    expect(service).toContain(
      'GRID_MARKET_LISTING_RULES.propertyTradeCooldownMinutes',
    );
    expect(service).toContain('openGridFixedPricePropertyListing(settlementPort');
    expect(service).toContain('cancelGridFixedPricePropertyListing(settlementPort');
  });

  it('surfaces owner listing creation and cancellation in the listings UI', () => {
    expect(client).toContain('Sell a property');
    expect(client).toContain("method: 'POST'");
    expect(client).toContain("method: 'DELETE'");
    expect(client).toContain('propertySlug: selectedPropertySlug');
    expect(client).toContain('priceCredits: price');
    expect(client).toContain('durationMinutes: duration');
    expect(client).toContain('Cancel your listing');
    expect(client).toContain('sellableProperties');
    expect(client).toContain('listedPropertySlugs');
  });

  it('keeps retry keys stable until a seller action succeeds', () => {
    expect(client).toContain("window.sessionStorage.getItem(storageKey)");
    expect(client).toContain("window.sessionStorage.setItem(storageKey, key)");
    expect(client).toContain('clearCommandKey(scope)');
  });
});
