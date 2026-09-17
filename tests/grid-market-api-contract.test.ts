import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isGridMarketListingReadEnabled,
  isGridMarketListingWriteEnabled,
} from '../lib/grid/server/market-listing-feature-flags';

const root = process.cwd();
const listingsRoute = fs.readFileSync(
  path.join(root, 'app/api/grid/market/listings/route.ts'),
  'utf8',
);
const listingDetailRoute = fs.readFileSync(
  path.join(root, 'app/api/grid/market/listings/[listingId]/route.ts'),
  'utf8',
);
const purchaseRoute = fs.readFileSync(
  path.join(
    root,
    'app/api/grid/market/listings/[listingId]/purchase/route.ts',
  ),
  'utf8',
);
const transactionsRoute = fs.readFileSync(
  path.join(root, 'app/api/grid/market/transactions/route.ts'),
  'utf8',
);
const auctionDetailRoute = fs.readFileSync(
  path.join(root, 'app/api/grid/auctions/[auctionId]/route.ts'),
  'utf8',
);

describe('Grid market API contract', () => {
  it('keeps reads and writes disabled unless explicitly enabled', () => {
    expect(isGridMarketListingReadEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isGridMarketListingWriteEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isGridMarketListingReadEnabled({
        NODE_ENV: 'test',
        GRID_MARKET_LISTING_READ_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isGridMarketListingWriteEnabled({
        NODE_ENV: 'test',
        GRID_MARKET_LISTING_WRITE_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('requires authentication and derives the viewer from the session on every read route', () => {
    for (const route of [listingsRoute, listingDetailRoute, transactionsRoute, auctionDetailRoute]) {
      expect(route).toContain('resolveAuthenticatedSession(request)');
      expect(route).toContain('Authentication required.');
      expect(route).toContain('export async function GET');
      expect(route).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    }
    expect(listingsRoute).toContain('viewerPlayerId: session.player.id');
    expect(listingDetailRoute).toContain('viewerPlayerId: session.player.id');
    expect(transactionsRoute).toContain('viewerPlayerId: session.player.id');
    expect(auctionDetailRoute).toContain('viewerPlayerId: session.player.id');
  });

  it('never trusts a client-supplied season, player, or city id on any market route', () => {
    for (const route of [listingsRoute, listingDetailRoute, purchaseRoute, transactionsRoute]) {
      expect(route).not.toMatch(/searchParams|get\('seasonId'\)/);
      expect(route).not.toMatch(/body\.playerId/);
      expect(route).not.toMatch(/body\.seasonId/);
      expect(route).not.toMatch(/body\.buyerPlayerId/);
      expect(route).toContain('cantonFoundingSeasonPackage');
    }
  });

  it('derives the buyer identity and command time on the server for purchases', () => {
    expect(purchaseRoute).toContain('resolveAuthenticatedSession(request)');
    expect(purchaseRoute).toContain('isGridMarketListingWriteEnabled()');
    expect(purchaseRoute).toContain('buyerPlayerId: session.player.id');
    expect(purchaseRoute).toContain('now: new Date().toISOString()');
    expect(purchaseRoute).toContain('export async function POST');
    expect(purchaseRoute).not.toMatch(/export async function (GET|PUT|PATCH|DELETE)/);
  });

  it('requires a non-empty idempotency key before purchasing', () => {
    expect(purchaseRoute).toContain('Missing idempotencyKey.');
    expect(purchaseRoute).toContain('purchaseGridMarketListing(');
  });

  it('gates every read route behind its feature flag', () => {
    expect(listingsRoute).toContain('isGridMarketListingReadEnabled()');
    expect(listingDetailRoute).toContain('isGridMarketListingReadEnabled()');
    expect(transactionsRoute).toContain('isGridMarketListingReadEnabled()');
    expect(auctionDetailRoute).toContain('isGridAuctionReadEnabled()');
  });
});
