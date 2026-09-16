import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import { cryptoSignalDiceRoller } from '@/lib/grid/server/crypto-signal-dice';
import { resolveGridContestSessionRound } from '@/lib/grid/server/contest-session-round-service';
import { isGridContestWriteEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridContestSessionRoundPort } from '@/lib/grid/server/supabase-contest-session-round';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '@/lib/supabase-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { contestId: string } },
) {
  const session = await resolveAuthenticatedSession(request);
  const response = (body: unknown, init?: ResponseInit) => {
    const result = NextResponse.json(body, init);
    setAuthCookies(
      result,
      session.refreshedSession,
      session.player?.id,
    );
    return result;
  };

  if (!isGridContestWriteEnabled()) {
    return response({ success: false, error: 'Grid contests are not enabled.' }, { status: 404 });
  }
  if (!session.player) {
    return response({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  if (!idempotencyKey.trim()) {
    return response(
      { success: false, error: 'Missing idempotencyKey.' },
      { status: 400 },
    );
  }

  const config = cantonFoundingSeasonPackage.seasonTemplate.contest;
  if (!config) {
    return response(
      { success: false, error: 'Contest rules are not configured.' },
      { status: 503 },
    );
  }

  try {
    const result = await resolveGridContestSessionRound(
      createSupabaseGridContestSessionRoundPort(),
      cryptoSignalDiceRoller,
      config,
      {
        contestId: params.contestId,
        attackerPlayerId: session.player.id,
        idempotencyKey,
        now: new Date().toISOString(),
      },
    );

    return response({ success: true, contest: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to resolve Grid contest round.';
    return response({ success: false, error: message }, { status: 400 });
  }
}
