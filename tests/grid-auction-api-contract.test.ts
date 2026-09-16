import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isGridAuctionReadEnabled,
  isGridAuctionWriteEnabled,
} from '../lib/grid/server/auction-feature-flags';

const activeRoute = fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/auctions/active/route.ts'),
  'utf8',
);
const bidRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/grid/auctions/[auctionId]/bid/route.ts',
  ),
  'utf8',
);

describe('Grid auction API contract', () => {
  it('keeps reads and writes disabled unless explicitly enabled', () => {
    expect(isGridAuctionReadEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isGridAuctionWriteEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isGridAuctionReadEnabled({
        NODE_ENV: 'test',
        GRID_AUCTION_READ_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isGridAuctionWriteEnabled({
        NODE_ENV: 'test',
        GRID_AUCTION_WRITE_ENABLED: '1',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('requires authentication for active auction discovery', () => {
    expect(activeRoute).toContain('resolveAuthenticatedSession(request)');
    expect(activeRoute).toContain('isGridAuctionReadEnabled()');
    expect(activeRoute).toContain('Authentication required.');
    expect(activeRoute).toContain('viewerPlayerId: session.player.id');
    expect(activeRoute).not.toMatch(/body\.playerId/);
    expect(activeRoute).toContain('export async function GET');
    expect(activeRoute).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
  });

  it('derives bid identity and command time on the server', () => {
    expect(bidRoute).toContain('resolveAuthenticatedSession(request)');
    expect(bidRoute).toContain('isGridAuctionWriteEnabled()');
    expect(bidRoute).toContain('bidderPlayerId: session.player.id');
    expect(bidRoute).toContain('now: new Date().toISOString()');
    expect(bidRoute).not.toMatch(/body\.bidderPlayerId/);
    expect(bidRoute).not.toMatch(/body\.playerId/);
    expect(bidRoute).not.toMatch(/body\.now/);
  });

  it('accepts only a safe integer bid and retry key from the player', () => {
    expect(bidRoute).toContain('Number.isSafeInteger(amountCredits)');
    expect(bidRoute).toContain('Missing idempotencyKey.');
    expect(bidRoute).toContain('Invalid amountCredits.');
    expect(bidRoute).toContain('placeGridAuctionBid(');
    expect(bidRoute).not.toMatch(/grid_schedule_property_auction/);
    expect(bidRoute).not.toMatch(/grid_settle_property_auction/);
  });
});
