import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { isGridDirectDealWriteEnabled } from '@/lib/grid/server/direct-deal-feature-flags';
import { acceptGridPlayerDirectDeal } from '@/lib/grid/server/direct-deal-market-service';
import { createSupabaseGridDirectDealMarketPort } from '@/lib/grid/server/supabase-direct-deal-market';
import { createSupabaseGridDirectDealProposalCommandPort } from '@/lib/grid/server/supabase-direct-deal-proposal';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: { proposalId: string } },
) {
  const session = await resolveAuthenticatedSession(request);
  const respond = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    setAuthCookies(response, session.refreshedSession, session.player?.id);
    return response;
  };

  if (!isGridDirectDealWriteEnabled()) {
    return respond(
      { success: false, error: 'Grid Direct Deal writes are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return respond(
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const proposalId = context.params.proposalId ?? '';
  const body = await request.json().catch(() => ({}));
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  if (!proposalId.trim() || !idempotencyKey.trim()) {
    return respond(
      { success: false, error: 'Missing proposalId or idempotencyKey.' },
      { status: 400 },
    );
  }

  try {
    const deal = await acceptGridPlayerDirectDeal(
      createSupabaseGridDirectDealMarketPort(cantonFoundingSeasonPackage),
      createSupabaseGridDirectDealProposalCommandPort(),
      {
        playerId: session.player.id,
        proposalId,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return respond({ success: true, deal });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to accept Direct Deal.';
    return respond({ success: false, error: message }, { status: 400 });
  }
}
