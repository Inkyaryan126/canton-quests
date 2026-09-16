import { NextResponse } from 'next/server';
import { isGridAuctionWriteEnabled } from '@/lib/grid/server/auction-feature-flags';
import { placeGridAuctionBid } from '@/lib/grid/server/auction-service';
import { createSupabaseGridAuctionCommandPort } from '@/lib/grid/server/supabase-auction';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: { auctionId: string } },
) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(result, session.refreshedSession, session.player?.id);
    return result;
  };

  if (!isGridAuctionWriteEnabled()) {
    return response(
      { success: false, error: 'Grid auction writes are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return response(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const auctionId = context.params.auctionId ?? '';
  const body = await request.json().catch(() => ({}));
  const amountCredits = body.amountCredits;
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  if (!auctionId.trim()) {
    return response(
      { success: false, error: 'Missing auctionId.' },
      { status: 400 },
    );
  }
  if (!Number.isSafeInteger(amountCredits) || amountCredits < 0) {
    return response(
      { success: false, error: 'Invalid amountCredits.' },
      { status: 400 },
    );
  }
  if (!idempotencyKey.trim()) {
    return response(
      { success: false, error: 'Missing idempotencyKey.' },
      { status: 400 },
    );
  }

  try {
    const bid = await placeGridAuctionBid(
      createSupabaseGridAuctionCommandPort(),
      {
        auctionId,
        bidderPlayerId: session.player.id,
        amountCredits,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, bid });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to place Grid auction bid.';
    return response({ success: false, error: message }, { status: 400 });
  }
}
