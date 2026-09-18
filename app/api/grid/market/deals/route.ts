import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import {
  isGridDirectDealReadEnabled,
  isGridDirectDealWriteEnabled,
} from '@/lib/grid/server/direct-deal-feature-flags';
import {
  createGridPlayerDirectDeal,
  listGridDirectDeals,
} from '@/lib/grid/server/direct-deal-market-service';
import { createSupabaseGridDirectDealMarketPort } from '@/lib/grid/server/supabase-direct-deal-market';
import { createSupabaseGridDirectDealProposalCommandPort } from '@/lib/grid/server/supabase-direct-deal-proposal';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

function respond(
  session: Awaited<ReturnType<typeof resolveAuthenticatedSession>>,
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Vary', 'Cookie');
  setAuthCookies(response, session.refreshedSession, session.player?.id);
  return response;
}

export async function GET(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  if (!isGridDirectDealReadEnabled()) {
    return respond(
      session,
      { success: false, error: 'Grid Direct Deals are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return respond(
      session,
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  try {
    const deals = await listGridDirectDeals(
      createSupabaseGridDirectDealMarketPort(cantonFoundingSeasonPackage),
      cantonFoundingSeasonPackage,
      session.player.id,
      new Date().toISOString(),
    );
    return respond(session, { success: true, deals });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load Direct Deals.';
    return respond(session, { success: false, error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await resolveAuthenticatedSession(request);
  if (!isGridDirectDealWriteEnabled()) {
    return respond(
      session,
      { success: false, error: 'Grid Direct Deal writes are not enabled.' },
      { status: 404 },
    );
  }
  if (!session.player) {
    return respond(
      session,
      { success: false, error: 'Authentication required.' },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const counterpartyCallsign =
    typeof body.counterpartyCallsign === 'string'
      ? body.counterpartyCallsign
      : '';
  const proposerCredits =
    typeof body.proposerCredits === 'number' ? body.proposerCredits : Number.NaN;
  const counterpartyCredits =
    typeof body.counterpartyCredits === 'number'
      ? body.counterpartyCredits
      : Number.NaN;
  const proposerPropertySlugs = Array.isArray(body.proposerPropertySlugs)
    ? body.proposerPropertySlugs.filter(
        (value: unknown): value is string => typeof value === 'string',
      )
    : [];
  const durationMinutes =
    typeof body.durationMinutes === 'number'
      ? body.durationMinutes
      : Number.NaN;
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';

  if (
    !counterpartyCallsign.trim() ||
    !Number.isSafeInteger(proposerCredits) ||
    !Number.isSafeInteger(counterpartyCredits) ||
    !Number.isSafeInteger(durationMinutes) ||
    !idempotencyKey.trim()
  ) {
    return respond(
      session,
      { success: false, error: 'Invalid Direct Deal terms.' },
      { status: 400 },
    );
  }

  try {
    const deal = await createGridPlayerDirectDeal(
      createSupabaseGridDirectDealMarketPort(cantonFoundingSeasonPackage),
      createSupabaseGridDirectDealProposalCommandPort(),
      {
        proposerPlayerId: session.player.id,
        counterpartyCallsign,
        proposerCredits,
        counterpartyCredits,
        proposerPropertySlugs,
        durationMinutes,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );
    return respond(session, { success: true, deal });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create Direct Deal.';
    return respond(session, { success: false, error: message }, { status: 400 });
  }
}
