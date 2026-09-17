import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const marketPage = fs.readFileSync(
  path.join(root, 'app/grid/market/page.tsx'),
  'utf8',
);
const marketClient = fs.readFileSync(
  path.join(root, 'app/grid/market/grid-market-client.tsx'),
  'utf8',
);
const listingsPage = fs.readFileSync(
  path.join(root, 'app/grid/market/listings/page.tsx'),
  'utf8',
);
const listingsClient = fs.readFileSync(
  path.join(root, 'app/grid/market/listings/grid-market-listings-client.tsx'),
  'utf8',
);
const auctionsPage = fs.readFileSync(
  path.join(root, 'app/grid/auctions/page.tsx'),
  'utf8',
);
const auctionsClient = fs.readFileSync(
  path.join(root, 'app/grid/auctions/grid-auctions-client.tsx'),
  'utf8',
);
const auctionDetailClient = fs.readFileSync(
  path.join(root, 'app/grid/auctions/[auctionId]/grid-auction-detail-client.tsx'),
  'utf8',
);

describe('Grid market/auction player UI contract', () => {
  it('keeps every staged market and auction route no-index', () => {
    for (const page of [marketPage, listingsPage, auctionsPage]) {
      expect(page).toContain('index: false');
      expect(page).toContain('follow: false');
    }
  });

  it('reads market state from the guarded read endpoints only', () => {
    expect(marketClient).toContain("fetch('/api/grid/world'");
    expect(marketClient).toContain("fetch('/api/grid/auctions/active'");
    expect(marketClient).toContain("fetch('/api/grid/market/listings'");
    expect(marketClient).toContain("fetch('/api/grid/market/transactions'");
    expect(marketClient).toContain("cache: 'no-store'");
  });

  it('never sends player, city, season, or ownership authority from the browser', () => {
    for (const client of [marketClient, listingsClient, auctionsClient, auctionDetailClient]) {
      expect(client).not.toContain('playerId:');
      expect(client).not.toContain('cityId:');
      expect(client).not.toContain('seasonId:');
      expect(client).not.toContain('ownerPlayerId:');
      expect(client).not.toContain('winnerPlayerId:');
    }
  });

  it('handles unauthenticated and disabled-feature states explicitly instead of hiding failures', () => {
    for (const client of [marketClient, listingsClient, auctionsClient]) {
      expect(client).toContain('href="/login"');
    }
    expect(listingsClient).toContain('401');
    expect(auctionsClient).toContain('401');
    expect(listingsClient).toContain('404');
    expect(auctionsClient).toContain('404');
    expect(marketClient).toContain('authRequired');
    expect(marketClient).toContain('projection.player.authenticated');
  });

  it('shows an intentional empty state instead of inventing fake listings or auctions', () => {
    expect(listingsClient).toContain('No properties listed');
    expect(auctionsClient).toContain('No active auctions');
    expect(marketClient).toContain('No auctions are active right now');
    expect(marketClient).toContain('No properties are listed for sale');
    expect(marketClient).toContain('No market activity yet');
  });

  it('renders auction and listing collections from live data rather than hard-coded rows', () => {
    expect(auctionsClient).toContain('auctions.map');
    expect(listingsClient).toContain('listings.map');
    expect(marketClient).toContain('endingSoon.slice');
  });

  it('generates a fresh idempotency key per bid and purchase attempt', () => {
    expect(auctionDetailClient).toContain('window.crypto.randomUUID()');
    expect(listingsClient).toContain('window.crypto.randomUUID()');
  });

  it('sends only the bid amount to the server and never computes a winner client-side', () => {
    expect(auctionDetailClient).toContain('amountCredits');
    expect(auctionDetailClient).not.toMatch(/const\s+winner|setWinner|winnerPlayerId/i);
    expect(auctionDetailClient).toContain(
      'The server resolves the winner, final price, and settlement.',
    );
  });

  it('disables purchase for a listing the viewer already owns or cannot afford', () => {
    expect(listingsClient).toContain('listing.viewerIsSeller');
    expect(listingsClient).toContain('!affordable || busy');
  });

  it('refreshes authoritative state after a bid or purchase instead of predicting the outcome locally', () => {
    expect(auctionDetailClient).toContain('await load()');
    expect(listingsClient).toContain('await load()');
  });
});
